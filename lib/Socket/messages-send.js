var __importDefault = this && this.__importDefault || function (n) {
  if (n && n.__esModule) {
    return n;
  } else {
    return {
      default: n
    };
  }
};
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeMessagesSocket = undefined;
const boom_1 = require("@hapi/boom");
const node_cache_1 = __importDefault(require("node-cache"));
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Utils_1 = require("../Utils");
const link_preview_1 = require("../Utils/link-preview");
const WABinary_1 = require("../WABinary");
const newsletter_1 = require("./newsletter");
var ListType = WAProto_1.proto.Message.ListMessage.ListType;
const makeMessagesSocket = n => {
  const {
    logger: m,
    linkPreviewImageThumbnailWidth: ma,
    generateHighQualityLinkPreview: na,
    options: oa,
    patchMessageBeforeSending: O
  } = n;
  const ba = (0, newsletter_1.makeNewsletterSocket)(n);
  const {
    ev: ca,
    authState: q,
    processingMutex: pa,
    signalRepository: G,
    upsertMessage: qa,
    query: L,
    fetchPrivacySettings: da,
    generateMessageTag: ra,
    sendNode: P,
    groupMetadata: sa,
    groupToggleEphemeral: ta
  } = ba;
  const ea = n.userDevicesCache || new node_cache_1.default({
    stdTTL: Defaults_1.DEFAULT_CACHE_TTLS.USER_DEVICES,
    useClones: false
  });
  let Q;
  const fa = async (a = false) => {
    const b = await Q;
    if (!b || a || new Date().getTime() - b.fetchDate.getTime() > b.ttl * 1000) {
      Q = (async () => {
        var c = await L({
          tag: "iq",
          attrs: {
            type: "set",
            xmlns: "w:m",
            to: WABinary_1.S_WHATSAPP_NET
          },
          content: [{
            tag: "media_conn",
            attrs: {}
          }]
        });
        c = (0, WABinary_1.getBinaryNodeChild)(c, "media_conn");
        c = {
          hosts: (0, WABinary_1.getBinaryNodeChildren)(c, "host").map(({
            attrs: d
          }) => ({
            hostname: d.hostname,
            maxContentLengthBytes: +d.maxContentLengthBytes
          })),
          auth: c.attrs.auth,
          ttl: +c.attrs.ttl,
          fetchDate: new Date()
        };
        m.debug("fetched media conn");
        return c;
      })();
    }
    return Q;
  };
  const ha = async (a, b, c, d) => {
    const e = {
      tag: "receipt",
      attrs: {
        id: c[0]
      }
    };
    if (d === "read" || d === "read-self") {
      e.attrs.t = (0, Utils_1.unixTimestampSeconds)().toString();
    }
    if (d === "sender" && (0, WABinary_1.isJidUser)(a)) {
      e.attrs.recipient = a;
      e.attrs.to = b;
    } else {
      e.attrs.to = a;
      if (b) {
        e.attrs.participant = b;
      }
    }
    if (d) {
      e.attrs.type = (0, WABinary_1.isJidNewsLetter)(a) ? "read-self" : d;
    }
    a = c.slice(1);
    if (a.length) {
      e.content = [{
        tag: "list",
        attrs: {},
        content: a.map(g => ({
          tag: "item",
          attrs: {
            id: g
          }
        }))
      }];
    }
    m.debug({
      attrs: e.attrs,
      messageIds: c
    }, "sending receipt for messages");
    await P(e);
  };
  const ia = async (a, b) => {
    a = (0, Utils_1.aggregateMessageKeysNotFromMe)(a);
    for (const {
      jid: c,
      participant: d,
      messageIds: e
    } of a) {
      await ha(c, d, e, b);
    }
  };
  const R = async (a, b, c) => {
    const e = [];
    if (!b) {
      m.debug("not using cache for devices");
    }
    const g = [];
    a = Array.from(new Set(a));
    for (let f of a) {
      a = (0, WABinary_1.jidDecode)(f)?.user;
      f = (0, WABinary_1.jidNormalizedUser)(f);
      const p = ea.get(a);
      if (p && b) {
        e.push(...p);
        m.trace({
          user: a
        }, "using cache for devices");
      } else {
        g.push({
          tag: "user",
          attrs: {
            jid: f
          }
        });
      }
    }
    if (!g.length) {
      return e;
    }
    b = {
      tag: "iq",
      attrs: {
        to: WABinary_1.S_WHATSAPP_NET,
        type: "get",
        xmlns: "usync"
      },
      content: [{
        tag: "usync",
        attrs: {
          sid: ra(),
          mode: "query",
          last: "true",
          index: "0",
          context: "message"
        },
        content: [{
          tag: "query",
          attrs: {},
          content: [{
            tag: "devices",
            attrs: {
              version: "2"
            }
          }]
        }, {
          tag: "list",
          attrs: {},
          content: g
        }]
      }]
    };
    b = await L(b);
    c = (0, Utils_1.extractDeviceJids)(b, q.creds.me.id, c);
    b = {};
    for (const f of c) {
      b[f.user] = b[f.user] || [];
      b[f.user].push(f);
      e.push(f);
    }
    for (const f in b) {
      ea.set(f, b[f]);
    }
    return e;
  };
  const S = async (a, b) => {
    var c = false;
    let d = [];
    if (b) {
      d = a;
    } else {
      b = a.map(e => G.jidToSignalProtocolAddress(e));
      b = await q.keys.get("session", b);
      for (const e of a) {
        a = G.jidToSignalProtocolAddress(e);
        if (!b[a]) {
          d.push(e);
        }
      }
    }
    if (d.length) {
      m.debug({
        jidsRequiringFetch: d
      }, "fetching sessions");
      c = await L({
        tag: "iq",
        attrs: {
          xmlns: "encrypt",
          type: "get",
          to: WABinary_1.S_WHATSAPP_NET
        },
        content: [{
          tag: "key",
          attrs: {},
          content: d.map(e => ({
            tag: "user",
            attrs: {
              jid: e
            }
          }))
        }]
      });
      await (0, Utils_1.parseAndInjectE2ESessions)(c, G);
      c = true;
    }
    return c;
  };
  const M = async (a, b, c) => {
    b = await O(b, a);
    const d = (0, Utils_1.encodeWAMessage)(b);
    let e = false;
    return {
      nodes: await Promise.all(a.map(async g => {
        const {
          type: f,
          ciphertext: p
        } = await G.encryptMessage({
          jid: g,
          data: d
        });
        if (f === "pkmsg") {
          e = true;
        }
        return {
          tag: "to",
          attrs: {
            jid: g
          },
          content: [{
            tag: "enc",
            attrs: {
              v: "2",
              type: f,
              ...(c || {})
            },
            content: p
          }]
        };
      })),
      shouldIncludeDeviceIdentity: e
    };
  };
  const la = async (a, b, {
    messageId: c,
    participant: d,
    additionalAttributes: e,
    additionalNodes: g,
    useUserDevicesCache: f,
    cachedGroupMetadata: p,
    statusJidList: H
  }) => {
    const r = q.creds.me.id;
    let v = false;
    const {
      user: u,
      server: I
    } = (0, WABinary_1.jidDecode)(a);
    const T = I === "g.us";
    const z = a === "status@broadcast";
    const J = I === "lid";
    const U = I === "newsletter";
    c = c || (0, Utils_1.generateMessageID)();
    f = f !== false;
    const B = [];
    const A = z ? "status@broadcast" : (0, WABinary_1.jidEncode)(u, J ? "lid" : T ? "g.us" : U ? "newsletter" : "s.whatsapp.net");
    const N = [];
    const w = [];
    const ua = {
      deviceSentMessage: {
        destinationJid: A,
        message: b
      }
    };
    if (d) {
      if (!T && !z) {
        e = {
          ...e,
          device_fanout: "false"
        };
      }
      const {
        user: t,
        device: x
      } = (0, WABinary_1.jidDecode)(d.jid);
      w.push({
        user: t,
        device: x
      });
    }
    await q.keys.transaction(async () => {
      var t;
      var x;
      var C;
      var D;
      var h = ja(b);
      if (T || z) {
        const [K, E] = await Promise.all([(async () => {
          let l = p ? await p(a) : undefined;
          if (l) {
            m.trace({
              jid: a,
              participants: l.participants.length
            }, "using cached group metadata");
          }
          if (!l && !z) {
            l = await sa(a);
          }
          return l;
        })(), (async () => d || z ? {} : (await q.keys.get("sender-key-memory", [a]))[a] || {})()]);
        if (!d) {
          var k = K && !z ? K.participants.map(l => l.id) : [];
          if (z && H) {
            k.push(...H);
          }
          k = await R(k, !!f, false);
          w.push(...k);
        }
        k = await O(b, w.map(l => (0, WABinary_1.jidEncode)(l.user, J ? "lid" : "s.whatsapp.net", l.device)));
        k = (0, Utils_1.encodeWAMessage)(k);
        const {
          ciphertext: V,
          senderKeyDistributionMessage: W
        } = await G.encryptGroupMessage({
          group: A,
          data: k,
          meId: r
        });
        k = [];
        for (const {
          user: l,
          device: X
        } of w) {
          var y = (0, WABinary_1.jidEncode)(l, J ? "lid" : "s.whatsapp.net", X);
          if (!E[y] || d) {
            k.push(y);
            E[y] = true;
          }
        }
        if (k.length) {
          m.debug({
            senderKeyJids: k
          }, "sending new sender key");
          y = {
            senderKeyDistributionMessage: {
              axolotlSenderKeyDistributionMessage: W,
              groupId: A
            }
          };
          await S(k, false);
          h = await M(k, y, h ? {
            mediatype: h
          } : undefined);
          v = v || h.shouldIncludeDeviceIdentity;
          B.push(...h.nodes);
        }
        N.push({
          tag: "enc",
          attrs: {
            v: "2",
            type: "skmsg"
          },
          content: V
        });
        await q.keys.set({
          "sender-key-memory": {
            [a]: E
          }
        });
      } else if (U) {
        if ((t = b.protocolMessage) === null || t === undefined ? 0 : t.editedMessage) {
          c = (x = b.protocolMessage.key) === null || x === undefined ? undefined : x.id;
          b = b.protocolMessage.editedMessage;
        }
        if (((C = b.protocolMessage) === null || C === undefined ? undefined : C.type) === WAProto_1.proto.Message.ProtocolMessage.Type.REVOKE) {
          c = (D = b.protocolMessage.key) === null || D === undefined ? undefined : D.id;
          b = {};
        }
        k = await O(b, []);
        k = WAProto_1.proto.Message.encode(k).finish();
        N.push({
          tag: "plaintext",
          attrs: h ? {
            mediatype: h
          } : {},
          content: k
        });
      } else {
        const {
          user: K,
          device: E
        } = (0, WABinary_1.jidDecode)(r);
        if (!d) {
          w.push({
            user: u
          });
          if (E !== undefined && E !== 0) {
            w.push({
              user: K
            });
          }
          t = await R([r, a], !!f, true);
          w.push(...t);
        }
        t = [];
        x = [];
        C = [];
        for (const {
          user: Y,
          device: va
        } of w) {
          D = Y === K;
          const Z = (0, WABinary_1.jidEncode)(D && J ? ((y = (k = q.creds) === null || k === undefined ? undefined : k.me) === null || y === undefined ? undefined : y.lid.split(":")[0]) || Y : Y, J ? "lid" : "s.whatsapp.net", va);
          if (D) {
            x.push(Z);
          } else {
            C.push(Z);
          }
          t.push(Z);
        }
        await S(t, false);
        const [{
          nodes: V,
          shouldIncludeDeviceIdentity: W
        }, {
          nodes: l,
          shouldIncludeDeviceIdentity: X
        }] = await Promise.all([M(x, ua, h ? {
          mediatype: h
        } : undefined), M(C, b, h ? {
          mediatype: h
        } : undefined)]);
        B.push(...V);
        B.push(...l);
        v = v || W || X;
      }
      if (B.length) {
        N.push({
          tag: "participants",
          attrs: {},
          content: B
        });
      }
      h = {
        tag: "message",
        attrs: {
          id: c,
          type: U ? F(b) : "text",
          ...(e || {})
        },
        content: N
      };
      if (d) {
        if ((0, WABinary_1.isJidGroup)(A)) {
          h.attrs.to = A;
          h.attrs.participant = d.jid;
        } else if ((0, WABinary_1.areJidsSameUser)(d.jid, r)) {
          h.attrs.to = d.jid;
          h.attrs.recipient = A;
        } else {
          h.attrs.to = d.jid;
        }
      } else {
        h.attrs.to = A;
      }
      if (v) {
        h.content.push({
          tag: "device-identity",
          attrs: {},
          content: (0, Utils_1.encodeSignedDeviceIdentity)(q.creds.account, true)
        });
        m.debug({
          jid: a
        }, "adding device identity");
      }
      if (g && g.length > 0) {
        h.content.push(...g);
      } else if (((0, WABinary_1.isJidGroup)(a) || (0, WABinary_1.isJidUser)(a)) && ((b === null || b === undefined ? 0 : b.viewOnceMessage) || (b === null || b === undefined ? 0 : b.viewOnceMessageV2) || (b === null || b === undefined ? 0 : b.viewOnceMessageV2Extension) || (b === null || b === undefined ? 0 : b.ephemeralMessage) || (b === null || b === undefined ? 0 : b.templateMessage) || (b === null || b === undefined ? 0 : b.interactiveMessage) || (b === null || b === undefined ? 0 : b.buttonsMessage))) {
        h.content.push({
          tag: "biz",
          attrs: {},
          content: [{
            tag: "interactive",
            attrs: {
              type: "native_flow",
              v: "1"
            },
            content: [{
              tag: "native_flow",
              attrs: {
                name: "quick_reply"
              }
            }]
          }]
        });
      }
      if (k = wa(b)) {
        h.content.push({
          tag: "biz",
          attrs: {},
          content: [{
            tag: k,
            attrs: ka(b)
          }]
        });
        m.debug({
          jid: a
        }, "adding business node");
      }
      m.debug({
        msgId: c
      }, `sending message to ${B.length} devices`);
      await P(h);
    });
    return c;
  };
  const F = a => a.viewOnceMessage ? F(a.viewOnceMessage.message) : a.viewOnceMessageV2 ? F(a.viewOnceMessageV2.message) : a.viewOnceMessageV2Extension ? F(a.viewOnceMessageV2Extension.message) : a.ephemeralMessage ? F(a.ephemeralMessage.message) : a.documentWithCaptionMessage ? F(a.documentWithCaptionMessage.message) : a.reactionMessage ? "reaction" : a.pollCreationMessage || a.pollCreationMessageV2 || a.pollCreationMessageV3 || a.pollUpdateMessage ? "reaction" : ja(a) ? "media" : "text";
  const ja = a => {
    if (a.imageMessage) {
      return "image";
    }
    if (a.videoMessage) {
      if (a.videoMessage.gifPlayback) {
        return "gif";
      } else {
        return "video";
      }
    }
    if (a.audioMessage) {
      if (a.audioMessage.ptt) {
        return "ptt";
      } else {
        return "audio";
      }
    }
    if (a.contactMessage) {
      return "vcard";
    }
    if (a.documentMessage) {
      return "document";
    }
    if (a.contactsArrayMessage) {
      return "contact_array";
    }
    if (a.liveLocationMessage) {
      return "livelocation";
    }
    if (a.stickerMessage) {
      return "sticker";
    }
    if (a.listMessage) {
      return "list";
    }
    if (a.listResponseMessage) {
      return "list_response";
    }
    if (a.buttonsResponseMessage) {
      return "buttons_response";
    }
    if (a.orderMessage) {
      return "order";
    }
    if (a.productMessage) {
      return "product";
    }
    if (a.interactiveResponseMessage) {
      return "native_flow_response";
    }
  };
  const wa = a => {
    if (a.buttonsMessage) {
      return "buttons";
    }
    if (a.buttonsResponseMessage) {
      return "buttons_response";
    }
    if (a.interactiveResponseMessage) {
      return "interactive_response";
    }
    if (a.listMessage) {
      return "list";
    }
    if (a.listResponseMessage) {
      return "list_response";
    }
  };
  const ka = a => {
    if (a.templateMessage) {
      return {};
    }
    if (a.listMessage) {
      a = a.listMessage.listType;
      if (!a) {
        throw new boom_1.Boom("Expected list type inside message");
      }
      return {
        v: "2",
        type: ListType[a].toLowerCase()
      };
    }
    return {};
  };
  const aa = (0, Utils_1.getWAUploadToServer)(n, fa);
  const xa = (0, Utils_1.bindWaitForEvent)(ca, "messages.media-update");
  return {
    ...ba,
    getPrivacyTokens: async a => {
      const b = (0, Utils_1.unixTimestampSeconds)().toString();
      return await L({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          xmlns: "privacy"
        },
        content: [{
          tag: "tokens",
          attrs: {},
          content: a.map(c => ({
            tag: "token",
            attrs: {
              jid: (0, WABinary_1.jidNormalizedUser)(c),
              t: b,
              type: "trusted_contact"
            }
          }))
        }]
      });
    },
    assertSessions: S,
    relayMessage: la,
    sendReceipt: ha,
    sendReceipts: ia,
    getButtonArgs: ka,
    readMessages: async a => {
      const b = (await da()).readreceipts === "all" ? "read" : "read-self";
      await ia(a, b);
    },
    refreshMediaConn: fa,
    getUSyncDevices: R,
    createParticipantNodes: M,
    waUploadToServer: aa,
    fetchPrivacySettings: da,
    updateMediaMessage: async a => {
      const b = (0, Utils_1.assertMediaContent)(a.message);
      const c = b.mediaKey;
      const d = (0, Utils_1.encryptMediaRetryRequest)(a.key, c, q.creds.me.id);
      let e = undefined;
      await Promise.all([P(d), xa(g => {
        if (g = g.find(f => f.key.id === a.key.id)) {
          if (g.error) {
            e = g.error;
          } else {
            try {
              const f = (0, Utils_1.decryptMediaRetryData)(g.media, c, g.key.id);
              if (f.result !== WAProto_1.proto.MediaRetryNotification.ResultType.SUCCESS) {
                throw new boom_1.Boom(`Media re-upload failed by device (${WAProto_1.proto.MediaRetryNotification.ResultType[f.result]})`, {
                  data: f,
                  statusCode: (0, Utils_1.getStatusCodeForMediaRetry)(f.result) || 404
                });
              }
              b.directPath = f.directPath;
              b.url = (0, Utils_1.getUrlFromDirectPath)(b.directPath);
              m.debug({
                directPath: f.directPath,
                key: g.key
              }, "media update successful");
            } catch (f) {
              e = f;
            }
          }
          return true;
        }
      })]);
      if (e) {
        throw e;
      }
      ca.emit("messages.update", [{
        key: a.key,
        update: {
          message: a.message
        }
      }]);
      return a;
    },
    sendMessage: async (a, b, c = {}) => {
      var e;
      var g = q.creds.me.id;
      if (typeof b === "object" && "disappearingMessagesInChat" in b && typeof b.disappearingMessagesInChat !== "undefined" && (0, WABinary_1.isJidGroup)(a)) {
        ({
          disappearingMessagesInChat: b
        } = b);
        await ta(a, typeof b === "boolean" ? b ? Defaults_1.WA_DEFAULT_EPHEMERAL : 0 : b);
      } else {
        let f;
        const p = await (0, Utils_1.generateWAMessage)(a, b, {
          logger: m,
          userJid: g,
          getUrlInfo: u => (0, link_preview_1.getUrlInfo)(u, {
            thumbnailWidth: ma,
            fetchOpts: {
              timeout: 3000,
              ...(oa || {})
            },
            logger: m,
            uploadImage: na ? aa : undefined
          }),
          upload: async (u, I) => {
            u = await aa(u, {
              ...I,
              newsletter: (0, WABinary_1.isJidNewsLetter)(a)
            });
            f = u.handle;
            return u;
          },
          mediaCache: n.mediaCache,
          options: n.options,
          ...c
        });
        g = "edit" in b && !!b.edit;
        const H = "ai" in b && !!b.ai;
        const r = {};
        const v = [];
        if ("delete" in b && b.delete) {
          if ((0, WABinary_1.isJidGroup)(b.delete?.remoteJid) && ((e = b.delete) === null || e === undefined || !e.fromMe) || (0, WABinary_1.isJidNewsLetter)(a)) {
            r.edit = "8";
          } else {
            r.edit = "7";
          }
        } else if (g) {
          r.edit = (0, WABinary_1.isJidNewsLetter)(a) ? "3" : "1";
        } else if (H) {
          v.push({
            attrs: {
              biz_bot: "1"
            },
            tag: "bot"
          });
        }
        if (f) {
          r.media_id = f;
        }
        if ("cachedGroupMetadata" in c) {
          console.warn("cachedGroupMetadata in sendMessage are deprecated, now cachedGroupMetadata is part of the socket config.");
        }
        await la(a, p.message, {
          messageId: p.key.id,
          cachedGroupMetadata: c.cachedGroupMetadata,
          additionalNodes: H ? v : c.additionalNodes,
          additionalAttributes: r,
          statusJidList: c.statusJidList
        });
        if (n.emitOwnEvents) {
          process.nextTick(() => {
            pa.mutex(() => qa(p, "append"));
          });
        }
        return p;
      }
    }
  };
};
exports.makeMessagesSocket = makeMessagesSocket;
