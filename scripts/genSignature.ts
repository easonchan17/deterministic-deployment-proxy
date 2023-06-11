import {ethers} from 'ethers'
import * as readline from 'readline'
import * as fs from 'fs'

const Config = require('./deploymentConfig.json')
console.log(Config)

import Web3 from 'web3'
const web3 = new Web3(Config.jsonRpc)

function waitForInput( message:string ) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	})

	return new Promise<string>((resolve) => {
		rl.question(message, (input) => {
			rl.close()
			resolve(input)
		})
	})
}

async function decodeOneTimeSignerKeystone() : Promise<any> {
	try {
		const fileData = fs.readFileSync(Config.oneTimeSignerKeystone, 'utf-8')
		const jsonData = JSON.parse( fileData )

		console.log( 'ONE TIME SIGNER ADDRESS IS : ', '0x'+jsonData.address )
		const pwd = await waitForInput('ENTER ONE TIME SIGNER PASSWORD FOR DECODING PRIVATE KEY, PASSWORD IS : ')

		const decryptedWallet = await ethers.Wallet.fromEncryptedJson(fileData, pwd)
		
		return new Promise((resolve, reject) => {
			resolve({
				address: '0x'+jsonData.address,
				privateKey: decryptedWallet.privateKey
			})
		})
	} catch (error) {
		console.log('Failed to decode keystone:', error)
		throw error;
	}
}

export async function genSignature(gasLimit:number, 
							gasPrice:number, 
							deploymentBytecode:string):Promise<any> {
	
	const oneTimeSigner = await decodeOneTimeSignerKeystone()
	console.log('oneTimeSigner', oneTimeSigner)

	const nonce = await web3.eth.getTransactionCount( oneTimeSigner.address )
	if ( nonce > 0 ) {
		let msg = `MUST USE ONE TIME SIGNER ADDRESS, NONCE SHOULD BE 0, BUT IT IS CURRENTLY ${nonce}!`
		let error = new Error(msg)
    	throw error
	}

	const chainId = await web3.eth.getChainId()
	console.log(chainId)
	let rawTx = {
		chainId: chainId,
		nonce: nonce,
		value: 0,
		gasPrice: web3.utils.toHex(gasPrice),
		gas: web3.utils.toHex(gasLimit),
		data: deploymentBytecode,
	}

	let res = await web3.eth.accounts.signTransaction(rawTx, oneTimeSigner.privateKey)
	return new Promise((resolve, reject) => {
		resolve({
			v: parseInt(res.v, 16),
			r:res.r.slice( 2 ),
			s:res.s.slice( 2 ),
			chainId: chainId,
			oddFlag: (res.v & 1) == 1 ? 0 : 1
		})
	})
}