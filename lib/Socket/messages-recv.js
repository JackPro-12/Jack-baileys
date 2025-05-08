var __importDefault = this && this.__importDefault || function (r) {
  if (r && r.__esModule) {
    return r;
  } else {
    return {
      default: r
    };
  }
};
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeMessagesRecvSocket = undefined;
const boom_1 = require("@hapi/boom");
const crypto_1 = require("crypto");
const node_cache_1 = __importDefault(require("node-cache"));
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const Utils_2 = require("../Utils");
const make_mutex_1 = require("../Utils/make-mutex");
const WABinary_1 = require("../WABinary");
const groups_1 = require("./groups");
const messages_send_1 = require("./messages-send");
const makeMessagesRecvSocket = r => {
  function Q(a) {
    a = y(a);
    var b = a.slice(0, 32);
    b = (0, Utils_1.derivePairingCodeKey)(h.creds.pairingCode, b);
    const d = a.slice(32, 48);
    a = a.slice(48, 80);
    return (0, Utils_1.aesDecryptCTR)(a, b, d);
  }
  function y(a) {
    if (a === undefined) {
      throw new boom_1.Boom("Invalid buffer", {
        statusCode: 400
      });
    }
    if (a instanceof Buffer) {
      return a;
    } else {
      return Buffer.from(a);
    }
  }
  const {
    logger: k,
    retryRequestDelayMs: H,
    maxMsgRetryCount: I,
    getMessage: J,
    shouldIgnoreJid: A
  } = r;
  const B = (0, messages_send_1.makeMessagesSocket)(r);
  const {
    ev: n,
    authState: h,
    ws: v,
    processingMutex: C,
    signalRepository: R,
    query: D,
    upsertMessage: E,
    resyncAppState: S,
    onUnexpectedError: K,
    assertSessions: L,
    sendNode: M,
    relayMessage: N,
    sendReceipt: O,
    uploadPreKeys: T,
    getUSyncDevices: U,
    createParticipantNodes: V
  } = B;
  const W = (0, make_mutex_1.makeMutex)();
  const w = r.msgRetryCounterCache || new node_cache_1.default({
    stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.MSG_RETRY,
    useClones: false
  });
  const F = r.callOfferCache || new node_cache_1.default({
    stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.CALL_OFFER,
    useClones: false
  });
  let G = false;
  const t = async ({
    tag: a,
    attrs: b,
    content: d
  }) => {
    const c = {
      tag: "ack",
      attrs: {
        id: b.id,
        to: b.from,
        class: a
      }
    };
    if (b.participant) {
      c.attrs.participant = b.participant;
    }
    if (b.recipient) {
      c.attrs.recipient = b.recipient;
    }
    if (b.type && (a !== "message" || (0, WABinary_1.getBinaryNodeChild)({
      tag: a,
      attrs: b,
      content: d
    }, "unavailable"))) {
      c.attrs.type = b.type;
    }
    if (a === "message" && (0, WABinary_1.getBinaryNodeChild)({
      tag: a,
      attrs: b,
      content: d
    }, "unavailable")) {
      c.attrs.from = h.creds.me.id;
    }
    k.debug({
      recv: {
        tag: a,
        attrs: b
      },
      sent: c.attrs
    }, "sent ack");
    await M(c);
  };
  const P = async (a, b = false) => {
    const d = a.attrs.id;
    let c = w.get(d) || 0;
    if (c >= I) {
      k.debug({
        retryCount: c,
        msgId: d
      }, "reached retry limit, clearing");
      w.del(d);
    } else {
      c += 1;
      w.set(d, c);
      var {
        account: g,
        signedPreKey: e,
        signedIdentityKey: m
      } = h.creds;
      var l = (0, Utils_1.encodeSignedDeviceIdentity)(g, true);
      await h.keys.transaction(async () => {
        const f = {
          tag: "receipt",
          attrs: {
            id: d,
            type: "retry",
            to: a.attrs.from
          },
          content: [{
            tag: "retry",
            attrs: {
              count: c.toString(),
              id: a.attrs.id,
              t: a.attrs.t,
              v: "1"
            }
          }, {
            tag: "registration",
            attrs: {},
            content: (0, Utils_1.encodeBigEndian)(h.creds.registrationId)
          }]
        };
        if (a.attrs.recipient) {
          f.attrs.recipient = a.attrs.recipient;
        }
        if (a.attrs.participant) {
          f.attrs.participant = a.attrs.participant;
        }
        if (c > 1 || b) {
          const {
            update: p,
            preKeys: q
          } = await (0, Utils_1.getNextPreKeys)(h, 1);
          const [u] = Object.keys(q);
          const x = q[+u];
          f.content.push({
            tag: "keys",
            attrs: {},
            content: [{
              tag: "type",
              attrs: {},
              content: Buffer.from(Defaults_1.KEY_BUNDLE_TYPE)
            }, {
              tag: "identity",
              attrs: {},
              content: m.public
            }, (0, Utils_1.xmppPreKey)(x, +u), (0, Utils_1.xmppSignedPreKey)(e), {
              tag: "device-identity",
              attrs: {},
              content: l
            }]
          });
          n.emit("creds.update", p);
        }
        await M(f);
        k.info({
          msgAttrs: a.attrs,
          retryCount: c
        }, "sent retry receipt");
      });
    }
  };
  const X = async a => {
    var b = a.attrs.from;
    if (b === WABinary_1.S_WHATSAPP_NET) {
      a = +(0, WABinary_1.getBinaryNodeChild)(a, "count").attrs.value;
      b = a < Defaults_1.MIN_PREKEY_COUNT;
      k.debug({
        count: a,
        shouldUploadMorePreKeys: b
      }, "recv pre-key count");
      if (b) {
        await T();
      }
    } else if ((0, WABinary_1.getBinaryNodeChild)(a, "identity")) {
      k.info({
        jid: b
      }, "identity changed");
    } else {
      k.info({
        node: a
      }, "unknown encrypt notification");
    }
  };
  const Y = (a, b, d) => {
    switch (b?.tag) {
      case "create":
        b = (0, groups_1.extractGroupMetadata)(b);
        d.messageStubType = Types_1.WAMessageStubType.GROUP_CREATE;
        d.messageStubParameters = [b.subject];
        d.key = {
          participant: b.owner
        };
        n.emit("chats.upsert", [{
          id: b.id,
          name: b.subject,
          conversationTimestamp: b.creation
        }]);
        n.emit("groups.upsert", [{
          ...b,
          author: a
        }]);
        break;
      case "ephemeral":
      case "not_ephemeral":
        d.message = {
          protocolMessage: {
            type: WAProto_1.proto.Message.ProtocolMessage.Type.EPHEMERAL_SETTING,
            ephemeralExpiration: +(b.attrs.expiration || 0)
          }
        };
        break;
      case "promote":
      case "demote":
      case "remove":
      case "add":
      case "leave":
        var c = `GROUP_PARTICIPANT_${b.tag.toUpperCase()}`;
        d.messageStubType = Types_1.WAMessageStubType[c];
        c = (0, WABinary_1.getBinaryNodeChildren)(b, "participant").map(g => g.attrs.jid);
        if (c.length === 1 && (0, WABinary_1.areJidsSameUser)(c[0], a) && b.tag === "remove") {
          d.messageStubType = Types_1.WAMessageStubType.GROUP_PARTICIPANT_LEAVE;
        }
        d.messageStubParameters = c;
        break;
      case "subject":
        d.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_SUBJECT;
        d.messageStubParameters = [b.attrs.subject];
        break;
      case "announcement":
      case "not_announcement":
        d.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_ANNOUNCE;
        d.messageStubParameters = [b.tag === "announcement" ? "on" : "off"];
        break;
      case "locked":
      case "unlocked":
        d.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_RESTRICT;
        d.messageStubParameters = [b.tag === "locked" ? "on" : "off"];
        break;
      case "invite":
        d.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_INVITE_LINK;
        d.messageStubParameters = [b.attrs.code];
        break;
      case "member_add_mode":
        if (a = b.content) {
          d.messageStubType = Types_1.WAMessageStubType.GROUP_MEMBER_ADD_MODE;
          d.messageStubParameters = [a.toString()];
        }
        break;
      case "membership_approval_mode":
        if (a = (0, WABinary_1.getBinaryNodeChild)(b, "group_join")) {
          d.messageStubType = Types_1.WAMessageStubType.GROUP_MEMBERSHIP_JOIN_APPROVAL_MODE;
          d.messageStubParameters = [a.attrs.state];
        }
    }
  };
  const Z = async a => {
    var b;
    var d;
    var c;
    const g = {};
    var [e] = (0, WABinary_1.getAllBinaryNodeChildren)(a);
    var m = a.attrs.type;
    var l = (0, WABinary_1.jidNormalizedUser)(a.attrs.from);
    switch (m) {
      case "privacy_token":
        a = (0, WABinary_1.getBinaryNodeChildren)(e, "token");
        for (const {
          attrs: p,
          content: q
        } of a) {
          a = p.jid;
          n.emit("chats.update", [{
            id: a,
            tcToken: q
          }]);
          k.debug({
            jid: a
          }, "got privacy token update");
        }
        break;
      case "w:gp2":
        Y(a.attrs.participant, e, g);
        break;
      case "mediaretry":
        a = (0, Utils_1.decodeMediaRetryNode)(a);
        n.emit("messages.media-update", [a]);
        break;
      case "encrypt":
        await X(a);
        break;
      case "devices":
        a = (0, WABinary_1.getBinaryNodeChildren)(e, "device");
        if ((0, WABinary_1.areJidsSameUser)(e.attrs.jid, h.creds.me.id)) {
          a = a.map(p => p.attrs.jid);
          k.info({
            deviceJids: a
          }, "got my own devices");
        }
        break;
      case "server_sync":
        if (a = (0, WABinary_1.getBinaryNodeChild)(a, "collection")) {
          await S([a.attrs.name], false);
        }
        break;
      case "picture":
        e = (0, WABinary_1.getBinaryNodeChild)(a, "set");
        var f = (0, WABinary_1.getBinaryNodeChild)(a, "delete");
        n.emit("contacts.update", [{
          id: (0, WABinary_1.jidNormalizedUser)((b = a?.attrs) === null || b === undefined ? undefined : b.jid) || ((c = (d = e || f) === null || d === undefined ? undefined : d.attrs) === null || c === undefined ? undefined : c.hash) || "",
          imgUrl: e ? "changed" : "removed"
        }]);
        if ((0, WABinary_1.isJidGroup)(l)) {
          a = e || f;
          g.messageStubType = Types_1.WAMessageStubType.GROUP_CHANGE_ICON;
          if (e) {
            g.messageStubParameters = [e.attrs.id];
          }
          g.participant = a === null || a === undefined ? undefined : a.attrs.author;
          g.key = {
            ...(g.key || {}),
            participant: e === null || e === undefined ? undefined : e.attrs.author
          };
        }
        break;
      case "account_sync":
        if (e.tag === "disappearing_mode") {
          a = +e.attrs.duration;
          b = +e.attrs.t;
          k.info({
            newDuration: a
          }, "updated account disappearing mode");
          n.emit("creds.update", {
            accountSettings: {
              ...h.creds.accountSettings,
              defaultDisappearingMode: {
                ephemeralExpiration: a,
                ephemeralSettingTimestamp: b
              }
            }
          });
        } else if (e.tag === "blocklist") {
          a = (0, WABinary_1.getBinaryNodeChildren)(e, "item");
          for ({
            attrs: f
          } of a) {
            n.emit("blocklist.update", {
              blocklist: [f.jid],
              type: f.action === "block" ? "add" : "remove"
            });
          }
        }
        break;
      case "link_code_companion_reg":
        d = (0, WABinary_1.getBinaryNodeChild)(a, "link_code_companion_reg");
        a = y((0, WABinary_1.getBinaryNodeChildBuffer)(d, "link_code_pairing_ref"));
        b = y((0, WABinary_1.getBinaryNodeChildBuffer)(d, "primary_identity_pub"));
        d = y((0, WABinary_1.getBinaryNodeChildBuffer)(d, "link_code_pairing_wrapped_primary_ephemeral_pub"));
        d = Q(d);
        d = Utils_1.Curve.sharedKey(h.creds.pairingEphemeralKeyPair.private, d);
        c = (0, crypto_1.randomBytes)(32);
        e = (0, crypto_1.randomBytes)(32);
        f = (0, Utils_1.hkdf)(d, 32, {
          salt: e,
          info: "link_code_pairing_key_bundle_encryption_key"
        });
        m = Buffer.concat([Buffer.from(h.creds.signedIdentityKey.public), b, c]);
        l = (0, crypto_1.randomBytes)(12);
        f = (0, Utils_1.aesEncryptGCM)(m, f, l, Buffer.alloc(0));
        e = Buffer.concat([e, l, f]);
        b = Utils_1.Curve.sharedKey(h.creds.signedIdentityKey.private, b);
        b = Buffer.concat([d, b, c]);
        h.creds.advSecretKey = (0, Utils_1.hkdf)(b, 32, {
          info: "adv_secret"
        }).toString("base64");
        await D({
          tag: "iq",
          attrs: {
            to: WABinary_1.S_WHATSAPP_NET,
            type: "set",
            id: B.generateMessageTag(),
            xmlns: "md"
          },
          content: [{
            tag: "link_code_companion_reg",
            attrs: {
              jid: h.creds.me.id,
              stage: "companion_finish"
            },
            content: [{
              tag: "link_code_pairing_wrapped_key_bundle",
              attrs: {},
              content: e
            }, {
              tag: "companion_identity_public",
              attrs: {},
              content: h.creds.signedIdentityKey.public
            }, {
              tag: "link_code_pairing_ref",
              attrs: {},
              content: a
            }]
          }]
        });
        h.creds.registered = true;
        n.emit("creds.update", h.creds);
    }
    if (Object.keys(g).length) {
      return g;
    }
  };
  const aa = (a, b) => {
    a = `${a}:${b}`;
    b = (w.get(a) || 0) + 1;
    w.set(a, b);
  };
  const ba = async (a, b, d) => {
    var c;
    const g = await Promise.all(b.map(f => J({
      ...a,
      id: f
    })));
    var e = a.remoteJid;
    const m = a.participant || e;
    const l = !((c = (0, WABinary_1.jidDecode)(m)) === null || c === undefined ? 0 : c.device);
    await L([m], true);
    if ((0, WABinary_1.isJidGroup)(e)) {
      await h.keys.set({
        "sender-key-memory": {
          [e]: null
        }
      });
    }
    k.debug({
      participant: m,
      sendToAll: l
    }, "forced new session for retry recp");
    for (c = 0; c < g.length; c++) {
      if (e = g[c]) {
        aa(b[c], m);
        const f = {
          messageId: b[c]
        };
        if (l) {
          f.useUserDevicesCache = false;
        } else {
          f.participant = {
            jid: m,
            count: +d.attrs.count
          };
        }
        await N(a.remoteJid, e, f);
      } else {
        k.debug({
          jid: a.remoteJid,
          id: b[c]
        }, "recv retry request, but message not available");
      }
    }
  };
  const ca = async a => {
    var b;
    const {
      attrs: c,
      content: g
    } = a;
    const e = c.from.includes("lid");
    const m = (0, WABinary_1.areJidsSameUser)(c.participant || c.from, e ? (b = h.creds.me) === null || b === undefined ? undefined : b.lid : h.creds.me?.id);
    const l = !m || (0, WABinary_1.isJidGroup)(c.from) ? c.from : c.recipient;
    const f = {
      remoteJid: l,
      id: "",
      fromMe: !c.recipient || c.type === "retry" && m,
      participant: c.participant
    };
    if (A(l) && l !== "@s.whatsapp.net") {
      k.debug({
        remoteJid: l
      }, "ignoring receipt from jid");
      await t(a);
    } else {
      var p = [c.id];
      if (Array.isArray(g)) {
        b = (0, WABinary_1.getBinaryNodeChildren)(g[0], "item");
        p.push(...b.map(q => q.attrs.id));
      }
      await Promise.all([C.mutex(async () => {
        const q = (0, Utils_1.getStatusFromReceiptType)(c.type);
        if (typeof q !== "undefined" && (q > WAProto_1.proto.WebMessageInfo.Status.DELIVERY_ACK || !m)) {
          if ((0, WABinary_1.isJidGroup)(l)) {
            if (c.participant) {
              const u = q === WAProto_1.proto.WebMessageInfo.Status.DELIVERY_ACK ? "receiptTimestamp" : "readTimestamp";
              n.emit("message-receipt.update", p.map(x => ({
                key: {
                  ...f,
                  id: x
                },
                receipt: {
                  userJid: (0, WABinary_1.jidNormalizedUser)(c.participant),
                  [u]: +c.t
                }
              })));
            }
          } else {
            n.emit("messages.update", p.map(u => ({
              key: {
                ...f,
                id: u
              },
              update: {
                status: q
              }
            })));
          }
        }
        if (c.type === "retry") {
          f.participant = f.participant || c.from;
          const u = (0, WABinary_1.getBinaryNodeChild)(a, "retry");
          if ((w.get(`${p[0]}:${f.participant}`) || 0) < I) {
            if (f.fromMe) {
              try {
                k.debug({
                  attrs: c,
                  key: f
                }, "recv retry request");
                await ba(f, p, u);
              } catch (x) {
                k.error({
                  key: f,
                  ids: p,
                  trace: x.stack
                }, "error in sending message again");
              }
            } else {
              k.info({
                attrs: c,
                key: f
              }, "recv retry for not fromMe message");
            }
          } else {
            k.info({
              attrs: c,
              key: f
            }, "will not send message again, as sent too many times");
          }
        }
      }), t(a)]);
    }
  };
  const da = async a => {
    const b = a.attrs.from;
    if (A(b) && b !== "@s.whatsapp.net") {
      k.debug({
        remoteJid: b,
        id: a.attrs.id
      }, "ignored notification");
      await t(a);
    } else {
      await Promise.all([C.mutex(async () => {
        var d;
        const c = await Z(a);
        if (c) {
          const g = (0, WABinary_1.areJidsSameUser)(a.attrs.participant || b, h.creds.me.id);
          c.key = {
            remoteJid: b,
            fromMe: g,
            participant: a.attrs.participant,
            id: a.attrs.id,
            ...(c.key || {})
          };
          if ((d = c.participant) !== null && d !== undefined) {
            d;
          } else {
            c.participant = a.attrs.participant;
          }
          c.messageTimestamp = +a.attrs.t;
          d = WAProto_1.proto.WebMessageInfo.fromObject(c);
          await E(d, "append");
        }
      }), t(a)]);
    }
  };
  const ea = async a => {
    if (A(a.attrs.from) && a.attrs.from !== "@s.whatsapp.net") {
      k.debug({
        key: a.attrs.key
      }, "ignored message");
      await t(a);
    } else {
      var {
        fullMessage: c,
        category: g,
        author: e,
        decrypt: m
      } = (0, Utils_1.decryptMessageNode)(a, h.creds.me.id, h.creds.me.lid || "", R, k);
      if (c.message?.protocolMessage?.type === WAProto_1.proto.Message.ProtocolMessage.Type.SHARE_PHONE_NUMBER && a.attrs.sender_pn) {
        n.emit("chats.phoneNumberShare", {
          lid: a.attrs.from,
          jid: a.attrs.sender_pn
        });
      }
      await Promise.all([C.mutex(async () => {
        await m();
        if (c.messageStubType === WAProto_1.proto.WebMessageInfo.StubType.CIPHERTEXT) {
          W.mutex(async () => {
            if (v.isOpen) {
              const f = (0, WABinary_1.getBinaryNodeChild)(a, "enc");
              await P(a, !f);
              if (H) {
                await (0, Utils_1.delay)(H);
              }
            } else {
              k.debug({
                node: a
              }, "connection closed, ignoring retry req");
            }
          });
        } else {
          var l = undefined;
          let f = c.key.participant;
          if (g === "peer") {
            l = "peer_msg";
          } else if (c.key.fromMe) {
            l = "sender";
            if ((0, WABinary_1.isJidUser)(c.key.remoteJid)) {
              f = e;
            }
          } else if (!G) {
            l = "inactive";
          }
          await O(c.key.remoteJid, f, [c.key.id], l);
          if ((0, Utils_1.getHistoryMsg)(c.message)) {
            l = (0, WABinary_1.jidNormalizedUser)(c.key.remoteJid);
            await O(l, undefined, [c.key.id], "hist_sync");
          }
        }
        (0, Utils_2.cleanMessage)(c, h.creds.me.id);
        await E(c, a.attrs.offline ? "append" : "notify");
      }), t(a)]);
    }
  };
  const fa = async a => {
    var {
      attrs: b
    } = a;
    var [d] = (0, WABinary_1.getAllBinaryNodeChildren)(a);
    const c = d.attrs["call-id"];
    const g = d.attrs.from || d.attrs["call-creator"];
    const e = (0, Utils_1.getCallStatusFromNode)(d);
    b = {
      chatId: b.from,
      from: g,
      id: c,
      date: new Date(+b.t * 1000),
      offline: !!b.offline,
      status: e
    };
    if (e === "offer") {
      b.isVideo = !!(0, WABinary_1.getBinaryNodeChild)(d, "video");
      b.isGroup = d.attrs.type === "group" || !!d.attrs["group-jid"];
      b.groupJid = d.attrs["group-jid"];
      F.set(b.id, b);
    }
    if (d = F.get(b.id)) {
      b.isVideo = d.isVideo;
      b.isGroup = d.isGroup;
    }
    if (e === "reject" || e === "accept" || e === "timeout") {
      F.del(b.id);
    }
    n.emit("call", [b]);
    await t(a);
  };
  const ha = async ({
    attrs: a
  }) => {
    const b = {
      remoteJid: a.from,
      fromMe: true,
      id: a.id
    };
    if (a.phash) {
      k.info({
        attrs: a
      }, "received phash in ack, resending message...");
      const d = await J(b);
      if (d) {
        await N(b.remoteJid, d, {
          messageId: b.id,
          useUserDevicesCache: false
        });
      } else {
        k.warn({
          attrs: a
        }, "could not send message again, as it was not found");
      }
    }
    if (a.error) {
      k.warn({
        attrs: a
      }, "received error in ack");
      n.emit("messages.update", [{
        key: b,
        update: {
          status: Types_1.WAMessageStatus.ERROR,
          messageStubParameters: [a.error]
        }
      }]);
    }
  };
  const z = async (a, b, d) => {
    n.buffer();
    await function () {
      return d(a).catch(c => K(c, b));
    }();
    n.flush();
  };
  v.on("CB:message", a => {
    z(a, "processing message", ea);
  });
  v.on("CB:call", async a => {
    z(a, "handling call", fa);
  });
  v.on("CB:receipt", a => {
    z(a, "handling receipt", ca);
  });
  v.on("CB:notification", async a => {
    z(a, "handling notification", da);
  });
  v.on("CB:ack,class:message", a => {
    ha(a).catch(b => K(b, "handling bad ack"));
  });
  n.on("call", ([a]) => {
    if (a.status === "timeout" || a.status === "offer" && a.isGroup) {
      var b = {
        key: {
          remoteJid: a.chatId,
          id: a.id,
          fromMe: false
        },
        messageTimestamp: (0, Utils_1.unixTimestampSeconds)(a.date)
      };
      if (a.status === "timeout") {
        b.messageStubType = a.isGroup ? a.isVideo ? Types_1.WAMessageStubType.CALL_MISSED_GROUP_VIDEO : Types_1.WAMessageStubType.CALL_MISSED_GROUP_VOICE : a.isVideo ? Types_1.WAMessageStubType.CALL_MISSED_VIDEO : Types_1.WAMessageStubType.CALL_MISSED_VOICE;
      } else {
        b.message = {
          call: {
            callKey: Buffer.from(a.id)
          }
        };
      }
      b = WAProto_1.proto.WebMessageInfo.fromObject(b);
      E(b, a.offline ? "append" : "notify");
    }
  });
  n.on("connection.update", ({
    isOnline: a
  }) => {
    if (typeof a !== "undefined") {
      G = a;
      k.trace(`sendActiveReceipts set to "${G}"`);
    }
  });
  return {
    ...B,
    sendMessageAck: t,
    sendRetryRequest: P,
    offerCall: async (a, b = false) => {
      const d = (0, crypto_1.randomBytes)(16).toString("hex").toUpperCase().substring(0, 64);
      var c = [];
      c.push({
        tag: "audio",
        attrs: {
          enc: "opus",
          rate: "16000"
        },
        content: undefined
      });
      c.push({
        tag: "audio",
        attrs: {
          enc: "opus",
          rate: "8000"
        },
        content: undefined
      });
      if (b) {
        c.push({
          tag: "video",
          attrs: {
            enc: "vp8",
            dec: "vp8",
            orientation: "0",
            screen_width: "1920",
            screen_height: "1080",
            device_orientation: "0"
          },
          content: undefined
        });
      }
      c.push({
        tag: "net",
        attrs: {
          medium: "3"
        },
        content: undefined
      });
      c.push({
        tag: "capability",
        attrs: {
          ver: "1"
        },
        content: new Uint8Array([1, 4, 255, 131, 207, 4])
      });
      c.push({
        tag: "encopt",
        attrs: {
          keygen: "2"
        },
        content: undefined
      });
      b = (0, crypto_1.randomBytes)(32);
      const g = (await U([a], true, false)).map(({
        user: l,
        device: f
      }) => (0, WABinary_1.jidEncode)(l, "s.whatsapp.net", f));
      await L(g, true);
      const {
        nodes: e,
        shouldIncludeDeviceIdentity: m
      } = await V(g, {
        call: {
          callKey: new Uint8Array(b)
        }
      }, {
        count: "0"
      });
      c.push({
        tag: "destination",
        attrs: {},
        content: e
      });
      if (m) {
        c.push({
          tag: "device-identity",
          attrs: {},
          content: (0, Utils_1.encodeSignedDeviceIdentity)(h.creds.account, true)
        });
      }
      c = {
        tag: "call",
        attrs: {
          id: (0, Utils_1.generateMessageIDV2)(),
          to: a
        },
        content: [{
          tag: "offer",
          attrs: {
            "call-id": d,
            "call-creator": h.creds.me.id
          },
          content: c
        }]
      };
      await D(c);
      return {
        id: d,
        to: a
      };
    },
    rejectCall: async (a, b) => {
      await D({
        tag: "call",
        attrs: {
          from: h.creds.me.id,
          to: b
        },
        content: [{
          tag: "reject",
          attrs: {
            "call-id": a,
            "call-creator": b,
            count: "0"
          },
          content: undefined
        }]
      });
    }
  };
};
exports.makeMessagesRecvSocket = makeMessagesRecvSocket;
