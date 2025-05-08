// Utility untuk meng-handle binding antar module (mirip __importStar di TypeScript)
var __createBinding = this && this.__createBinding || (Object.create ? function (target, source, key, alias = key) {
  var desc = Object.getOwnPropertyDescriptor(source, key);
  if (!desc || ("get" in desc ? !source.__esModule : desc.writable || desc.configurable)) {
    desc = {
      enumerable: true,
      get: function () {
        return source[key];
      }
    };
  }
  Object.defineProperty(target, alias, desc);
} : function (target, source, key, alias = key) {
  target[alias] = source[key];
});

// Utility untuk set module default
var __setModuleDefault = this && this.__setModuleDefault || (Object.create ? function (target, value) {
  Object.defineProperty(target, "default", {
    enumerable: true,
    value: value
  });
} : function (target, value) {
  target.default = value;
});

// Utility untuk import semua module
var __importStar = this && this.__importStar || function (mod) {
  if (mod && mod.__esModule) return mod;
  var result = {};
  if (mod != null) {
    for (var key in mod) {
      if (key !== "default" && Object.prototype.hasOwnProperty.call(mod, key)) {
        __createBinding(result, mod, key);
      }
    }
  }
  __setModuleDefault(result, mod);
  return result;
};

// Definisikan module export
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeLibSignalRepository = undefined;

// Import module
const libsignal = __importStar(require("libsignal"));
const WASignalGroup_1 = require("../../WASignalGroup");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");

// Fungsi utama buat repository enkripsi
function makeLibSignalRepository(d) {
  const b = signalStorage(d);

  return {
    // Dekripsi pesan grup
    decryptGroupMessage({ group: a, authorJid: c, msg: e }) {
      a = jidToSignalSenderKeyName(a, c);
      return new WASignalGroup_1.GroupCipher(b, a).decrypt(e);
    },

    // Proses distribusi kunci grup
    async processSenderKeyDistributionMessage({ item: a, authorJid: c }) {
      const e = new WASignalGroup_1.GroupSessionBuilder(b);
      c = jidToSignalSenderKeyName(a.groupId, c);
      a = new WASignalGroup_1.SenderKeyDistributionMessage(null, null, null, null, a.axolotlSenderKeyDistributionMessage);
      const { [c]: f } = await d.keys.get("sender-key", [c]);
      if (!f) {
        await b.storeSenderKey(c, new WASignalGroup_1.SenderKeyRecord());
      }
      await e.process(c, a);
    },

    // Dekripsi pesan biasa
    async decryptMessage({ jid: a, type: c, ciphertext: e }) {
      a = jidToSignalProtocolAddress(a);
      a = new libsignal.SessionCipher(b, a);
      let f;
      switch (c) {
        case "pkmsg":
          f = await a.decryptPreKeyWhisperMessage(e);
          break;
        case "msg":
          f = await a.decryptWhisperMessage(e);
      }
      return f;
    },

    // Enkripsi pesan biasa
    async encryptMessage({ jid: a, data: c }) {
      a = jidToSignalProtocolAddress(a);
      a = new libsignal.SessionCipher(b, a);
      const { type: e, body: f } = await a.encrypt(c);
      return {
        type: e === 3 ? "pkmsg" : "msg",
        ciphertext: Buffer.from(f, "binary")
      };
    },

    // Enkripsi pesan grup
    async encryptGroupMessage({ group: a, meId: c, data: e }) {
      a = jidToSignalSenderKeyName(a, c);
      c = new WASignalGroup_1.GroupSessionBuilder(b);
      const { [a]: f } = await d.keys.get("sender-key", [a]);
      if (!f) {
        await b.storeSenderKey(a, new WASignalGroup_1.SenderKeyRecord());
      }
      c = await c.create(a);
      return {
        ciphertext: await new WASignalGroup_1.GroupCipher(b, a).encrypt(e),
        senderKeyDistributionMessage: c.serialize()
      };
    },

    // Inject session E2E baru
    async injectE2ESession({ jid: a, session: c }) {
      await new libsignal.SessionBuilder(b, jidToSignalProtocolAddress(a)).initOutgoing(c);
    },

    // Konversi JID ke address Signal
    jidToSignalProtocolAddress(a) {
      return jidToSignalProtocolAddress(a).toString();
    }
  };
}
exports.makeLibSignalRepository = makeLibSignalRepository;

// Fungsi untuk konversi JID WA ke ProtocolAddress Signal
const jidToSignalProtocolAddress = d => {
  const { user: b, device: a } = (0, WABinary_1.jidDecode)(d);
  return new libsignal.ProtocolAddress(b, a || 0);
};

// Fungsi untuk konversi ke SenderKeyName
const jidToSignalSenderKeyName = (d, b) => new WASignalGroup_1.SenderKeyName(d, jidToSignalProtocolAddress(b)).toString();

// Storage handler Signal
function signalStorage({ creds: d, keys: b }) {
  return {
    // Load sesi
    loadSession: async a => {
      ({ [a]: a } = await b.get("session", [a]));
      if (a) {
        return libsignal.SessionRecord.deserialize(a);
      }
    },

    // Simpan sesi
    storeSession: async (a, c) => {
      await b.set({
        session: { [a]: c.serialize() }
      });
    },

    // Validasi identitas selalu true (default WA behavior)
    isTrustedIdentity: () => true,

    // Load pre-key
    loadPreKey: async a => {
      a = a.toString();
      ({ [a]: a } = await b.get("pre-key", [a]));
      if (a) {
        return {
          privKey: Buffer.from(a.private),
          pubKey: Buffer.from(a.public)
        };
      }
    },

    // Hapus pre-key
    removePreKey: a => b.set({ "pre-key": { [a]: null } }),

    // Load signed pre-key (digunakan saat initial handshake)
    loadSignedPreKey: () => {
      const a = d.signedPreKey;
      return {
        privKey: Buffer.from(a.keyPair.private),
        pubKey: Buffer.from(a.keyPair.public)
      };
    },

    // Load sender-key (digunakan untuk grup)
    loadSenderKey: async a => {
      ({ [a]: a } = await b.get("sender-key", [a]));
      if (a) {
        return new WASignalGroup_1.SenderKeyRecord(a);
      }
    },

    // Simpan sender-key
    storeSenderKey: async (a, c) => {
      await b.set({
        "sender-key": { [a]: c.serialize() }
      });
    },

    // Ambil ID registrasi kita
    getOurRegistrationId: () => d.registrationId,

    // Ambil identity key kita
    getOurIdentity: () => {
      const { signedIdentityKey: a } = d;
      return {
        privKey: Buffer.from(a.private),
        pubKey: (0, Utils_1.generateSignalPubKey)(a.public)
      };
    }
  };
}
