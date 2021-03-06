import bs58check from 'bs58check'
import debug from 'debug'
import assert from 'assert'
import { Observable as O } from './rxjs'

const BLIND_PREFIX = +process.env.BLIND_PREFIX || 0x0c

// not null or undefined
export const notNully = x => x != null

// Transaction helpers

const nativeAssetId    = process.env.NATIVE_ASSET_ID    || '6f0279e9ed041c3d710a9f57d0c02928416460c4b722ae3457a11eec381c526d'
    , nativeAssetLabel = process.env.NATIVE_ASSET_LABEL || 'BTC'

export const isAnyConfidential = tx => tx.vout.some(vout => vout.value == null)

export const isAnyPegout = tx => tx.vout.some(vout => !!vout.pegout_scriptpubkey_type)

export const isRbf = tx => tx.vin.some(vin => vin.sequence < 0xfffffffe)

export const isAllNative = tx => tx.vout.every(isNativeOut)

export const outTotal = tx => tx.vout.reduce((N, vout) => N + (vout.value || 0), 0)

export const isNativeOut = vout => (!vout.asset && !vout.assetcommitment) || vout.asset === nativeAssetId

export const outAssetLabel = vout =>
  isNativeOut(vout)  ? nativeAssetLabel
: vout.asset != null ? `[${vout.asset.substr(0, 8)}]`
: '[Unknown]'

// Address helpers

// Try removing blinding key from confidential address and return in standard address encoding
export const tryUnconfidentialAddress = addr => {
  try {
    const bytes = bs58check.decode(addr)
    assert(bytes.length == 55 && bytes[0] == BLIND_PREFIX)
    return bs58check.encode(Buffer.concat([bytes.slice(1, 2), bytes.slice(-20)]))
  } catch (e) {
    return addr
  }
}

// Array helpers

export const last = arr => arr.length ? arr[arr.length-1] : null
export const remove = (arr, val) => arr.filter(x => x !== val)
export const add = (arr, val) => [ ...remove(arr, val), val ]

// Stream helpers

export const combine = obj => {
  const keys = Object.keys(obj).map(k => k.replace(/\$$/, ''))
  return O.combineLatest(...Object.values(obj).map(x$ => x$.startWith(null))
    , (...xs) => xs.reduce((o, x, i) => (o[keys[i]] = x, o), {}))
}

export const dropErrors = r$$ => r$$.switchMap(r$ => r$.catch(_ => O.empty()))

export const extractErrors = r$$ =>
  r$$.flatMap(r$ => r$.flatMap(_ => O.empty()).catch(err => O.of(err)))
    .map(e => e.response && (e.response.body && e.response.body.message || e.response.body || e.response.text) || e)

export const dbg = (obj, label='stream', dbg=debug(label)) =>
  Object.keys(obj).forEach(k => obj[k] && obj[k].subscribe(
    x   => dbg(`${k} ->`, x)
  , err => dbg(`${k} \x1b[91mError:\x1b[0m`, err.stack || err)
  , _   => dbg(`${k} completed`)))
