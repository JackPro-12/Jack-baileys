var __importDefault = this && this.__importDefault || function (a) {
  if (a && a.__esModule) {
    return a;
  } else {
    return {
      default: a
    };
  }
};
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.mobileRegisterFetch = exports.mobileRegisterEncrypt = exports.mobileRegister = exports.mobileRegisterExists = exports.mobileRegisterCode = exports.registrationParams = exports.makeRegistrationSocket = undefined;
const axios_1 = __importDefault(require("axios"));
const Defaults_1 = require("../Defaults");
const crypto_1 = require("../Utils/crypto");
const WABinary_1 = require("../WABinary");
const business_1 = require("./business");
function urlencode(a) {
  return a.replace(/-/g, "%2d").replace(/_/g, "%5f").replace(/~/g, "%7e");
}
const validRegistrationOptions = a => a?.phoneNumberCountryCode && a.phoneNumberNationalNumber && a.phoneNumberMobileCountryCode;
const makeRegistrationSocket = a => {
  const b = (0, business_1.makeBusinessSocket)(a);
  return {
    ...b,
    register: async c => {
      if (!validRegistrationOptions(a.auth.creds.registration)) {
        throw Error("please specify the registration options");
      }
      c = await mobileRegister({
        ...b.authState.creds,
        ...b.authState.creds.registration,
        code: c
      }, a.options);
      b.authState.creds.me = {
        id: (0, WABinary_1.jidEncode)(c.login, "s.whatsapp.net"),
        name: "~"
      };
      b.authState.creds.registered = true;
      b.ev.emit("creds.update", b.authState.creds);
      return c;
    },
    requestRegistrationCode: async c => {
      c = c || a.auth.creds.registration;
      if (!validRegistrationOptions(c)) {
        throw Error("Invalid registration options");
      }
      b.authState.creds.registration = c;
      b.ev.emit("creds.update", b.authState.creds);
      return mobileRegisterCode({
        ...a.auth.creds,
        ...c
      }, a.options);
    }
  };
};
exports.makeRegistrationSocket = makeRegistrationSocket;
function convertBufferToUrlHex(a) {
  var b = "";
  a.forEach(c => {
    b += `%${c.toString(16).padStart(2, "0").toLowerCase()}`;
  });
  return b;
}
function registrationParams(a) {
  const b = Buffer.alloc(4);
  b.writeInt32BE(a.registrationId);
  Buffer.alloc(3).writeInt16BE(a.signedPreKey.keyId);
  a.phoneNumberCountryCode = a.phoneNumberCountryCode.replace("+", "").trim();
  a.phoneNumberNationalNumber = a.phoneNumberNationalNumber.replace(/[/-\s)(]/g, "").trim();
  return {
    cc: a.phoneNumberCountryCode,
    in: a.phoneNumberNationalNumber,
    Rc: "0",
    lg: "en",
    lc: "GB",
    mistyped: "6",
    authkey: Buffer.from(a.noiseKey.public).toString("base64url"),
    e_regid: b.toString("base64url"),
    e_keytype: "BQ",
    e_ident: Buffer.from(a.signedIdentityKey.public).toString("base64url"),
    e_skey_id: "AAAA",
    e_skey_val: Buffer.from(a.signedPreKey.keyPair.public).toString("base64url"),
    e_skey_sig: Buffer.from(a.signedPreKey.signature).toString("base64url"),
    fdid: a.phoneId,
    network_ratio_type: "1",
    expid: a.deviceId,
    simnum: "1",
    hasinrc: "1",
    pid: Math.floor(Math.random() * 1000).toString(),
    id: convertBufferToUrlHex(a.identityId),
    backup_token: convertBufferToUrlHex(a.backupToken),
    token: (0, crypto_1.md5)(Buffer.concat([Defaults_1.MOBILE_TOKEN, Buffer.from(a.phoneNumberNationalNumber)])).toString("hex"),
    fraud_checkpoint_code: a.captcha
  };
}
exports.registrationParams = registrationParams;
function mobileRegisterCode(a, b) {
  return mobileRegisterFetch("/code", {
    params: {
      ...registrationParams(a),
      mcc: `${a.phoneNumberMobileCountryCode}`.padStart(3, "0"),
      mnc: `${a.phoneNumberMobileNetworkCode || "001"}`.padStart(3, "0"),
      sim_mcc: "000",
      sim_mnc: "000",
      method: a?.method || "sms",
      reason: "",
      hasav: "1"
    },
    ...b
  });
}
exports.mobileRegisterCode = mobileRegisterCode;
function mobileRegisterExists(a, b) {
  return mobileRegisterFetch("/exist", {
    params: registrationParams(a),
    ...b
  });
}
exports.mobileRegisterExists = mobileRegisterExists;
async function mobileRegister(a, b) {
  return mobileRegisterFetch("/register", {
    params: {
      ...registrationParams(a),
      code: a.code.replace("-", "")
    },
    ...b
  });
}
exports.mobileRegister = mobileRegister;
function mobileRegisterEncrypt(a) {
  const b = crypto_1.Curve.generateKeyPair();
  const c = crypto_1.Curve.sharedKey(b.private, Defaults_1.REGISTRATION_PUBLIC_KEY);
  a = (0, crypto_1.aesEncryptGCM)(Buffer.from(a), new Uint8Array(c), Buffer.alloc(12), Buffer.alloc(0));
  return Buffer.concat([Buffer.from(b.public), a]).toString("base64url");
}
exports.mobileRegisterEncrypt = mobileRegisterEncrypt;
async function mobileRegisterFetch(a, b = {}) {
  a = `${Defaults_1.MOBILE_REGISTRATION_ENDPOINT}${a}`;
  if (b.params) {
    const d = [];
    for (var c in b.params) {
      if (b.params[c] !== null && b.params[c] !== undefined) {
        d.push(c + "=" + urlencode(b.params[c]));
      }
    }
    a += `?${d.join("&")}`;
    delete b.params;
  }
  b.headers ||= {};
  b.headers["User-Agent"] = Defaults_1.MOBILE_USERAGENT;
  b = await (0, axios_1.default)(a, b);
  c = b.data;
  if (b.status > 300 || c.reason) {
    throw c;
  }
  if (c.status && !["ok", "sent"].includes(c.status)) {
    throw c;
  }
  return c;
}
exports.mobileRegisterFetch = mobileRegisterFetch;
