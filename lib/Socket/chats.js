var __importDefault = this && this.__importDefault || function (m) {
  if (m && m.__esModule) {
    return m;
  } else {
    return {
      default: m
    };
  }
};
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeChatsSocket = undefined;
const boom_1 = require("@hapi/boom");
const WAProto_1 = require("../../WAProto");
const Defaults_1 = require("../Defaults");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const make_mutex_1 = require("../Utils/make-mutex");
const process_message_1 = __importDefault(require("../Utils/process-message"));
const WABinary_1 = require("../WABinary");
const socket_1 = require("./socket");
const MAX_SYNC_ATTEMPTS = 2;
const makeChatsSocket = m => {
  const {
    logger: l,
    markOnlineOnConnect: V,
    fireInitQueries: W,
    appStateMacVerification: I,
    shouldIgnoreJid: X,
    shouldSyncHistoryMessage: Y
  } = m;
  const J = (0, socket_1.makeSocket)(m);
  const {
    ev: p,
    ws: E,
    authState: e,
    generateMessageTag: F,
    sendNode: B,
    query: r,
    onUnexpectedError: K
  } = J;
  let G;
  let L = false;
  let C = false;
  const M = (0, make_mutex_1.makeMutex)();
  const D = async a => {
    ({
      [a]: a
    } = await e.keys.get("app-state-sync-key", [a]));
    return a;
  };
  const N = async (a = false) => {
    if (!G || a) {
      ({
        content: a
      } = await r({
        tag: "iq",
        attrs: {
          xmlns: "privacy",
          to: WABinary_1.S_WHATSAPP_NET,
          type: "get"
        },
        content: [{
          tag: "privacy",
          attrs: {}
        }]
      }));
      G = (0, WABinary_1.reduceBinaryNodeToDictionary)(a?.[0], "category");
    }
    return G;
  };
  const y = async (a, b) => {
    await r({
      tag: "iq",
      attrs: {
        xmlns: "privacy",
        to: WABinary_1.S_WHATSAPP_NET,
        type: "set"
      },
      content: [{
        tag: "privacy",
        attrs: {},
        content: [{
          tag: "category",
          attrs: {
            name: a,
            value: b
          }
        }]
      }]
    });
  };
  const O = async (a, b) => {
    a = await r({
      tag: "iq",
      attrs: {
        to: WABinary_1.S_WHATSAPP_NET,
        type: "get",
        xmlns: "usync"
      },
      content: [{
        tag: "usync",
        attrs: {
          sid: F(),
          mode: "query",
          last: "true",
          index: "0",
          context: "interactive"
        },
        content: [{
          tag: "query",
          attrs: {},
          content: [b]
        }, {
          tag: "list",
          attrs: {},
          content: a
        }]
      }]
    });
    a = (0, WABinary_1.getBinaryNodeChild)(a, "usync");
    a = (0, WABinary_1.getBinaryNodeChild)(a, "list");
    return (0, WABinary_1.getBinaryNodeChildren)(a, "user");
  };
  const P = async () => {
    var a = await r({
      tag: "iq",
      attrs: {
        xmlns: "blocklist",
        to: WABinary_1.S_WHATSAPP_NET,
        type: "get"
      }
    });
    a = (0, WABinary_1.getBinaryNodeChild)(a, "list");
    return (0, WABinary_1.getBinaryNodeChildren)(a, "item").map(b => b.attrs.jid);
  };
  const Q = async (a, b) => {
    l.info({
      fromTimestamp: b
    }, "clean dirty bits " + a);
    await B({
      tag: "iq",
      attrs: {
        to: WABinary_1.S_WHATSAPP_NET,
        type: "set",
        xmlns: "urn:xmpp:whatsapp:dirty",
        id: F()
      },
      content: [{
        tag: "clean",
        attrs: {
          type: a,
          ...(b ? {
            timestamp: b.toString()
          } : null)
        }
      }]
    });
  };
  const R = a => ({
    onMutation(b) {
      (0, Utils_1.processSyncAction)(b, p, e.creds.me, a ? {
        accountSettings: e.creds.accountSettings
      } : undefined, l);
    }
  });
  const H = p.createBufferedFunction(async (a, b) => {
    const c = {};
    const f = {};
    await e.keys.transaction(async () => {
      const h = new Set(a);
      const k = {};
      while (h.size) {
        const w = {};
        var n = [];
        for (const t of h) {
          var d = (await e.keys.get("app-state-sync-version", [t]))[t];
          if (d) {
            if (typeof c[t] === "undefined") {
              c[t] = d.version;
            }
          } else {
            d = (0, Utils_1.newLTHashState)();
          }
          w[t] = d;
          l.info(`resyncing ${t} from v${d.version}`);
          n.push({
            tag: "collection",
            attrs: {
              name: t,
              version: d.version.toString(),
              return_snapshot: (!d.version).toString()
            }
          });
        }
        n = await r({
          tag: "iq",
          attrs: {
            to: WABinary_1.S_WHATSAPP_NET,
            xmlns: "w:sync:app:state",
            type: "set"
          },
          content: [{
            tag: "sync",
            attrs: {},
            content: n
          }]
        });
        n = await (0, Utils_1.extractSyncdPatches)(n, m?.options);
        for (const t in n) {
          d = t;
          const {
            patches: z,
            hasMorePatches: A,
            snapshot: u
          } = n[d];
          try {
            if (u) {
              const {
                state: q,
                mutationMap: v
              } = await (0, Utils_1.decodeSyncdSnapshot)(d, u, D, c[d], I.snapshot);
              w[d] = q;
              Object.assign(f, v);
              l.info(`restored state of ${d} from snapshot to v${q.version} with mutations`);
              await e.keys.set({
                "app-state-sync-version": {
                  [d]: q
                }
              });
            }
            if (z.length) {
              const {
                state: q,
                mutationMap: v
              } = await (0, Utils_1.decodePatches)(d, z, w[d], D, m.options, c[d], l, I.patch);
              await e.keys.set({
                "app-state-sync-version": {
                  [d]: q
                }
              });
              l.info(`synced ${d} to v${q.version}`);
              c[d] = q.version;
              Object.assign(f, v);
            }
            if (A) {
              l.info(`${d} has more patches...`);
            } else {
              h.delete(d);
            }
          } catch (q) {
            const v = k[d] >= MAX_SYNC_ATTEMPTS || q.output?.statusCode === 404 || q.name === "TypeError";
            l.info({
              name: d,
              error: q.stack
            }, `failed to sync state from version${v ? "" : ", removing and trying from scratch"}`);
            await e.keys.set({
              "app-state-sync-version": {
                [d]: null
              }
            });
            k[d] = (k[d] || 0) + 1;
            if (v) {
              h.delete(d);
            }
          }
        }
      }
    });
    ({
      onMutation: b
    } = R(b));
    for (const g in f) {
      b(f[g]);
    }
  });
  const S = async (a, b) => {
    const c = e.creds.me;
    if (a === "available" || a === "unavailable") {
      if (c.name) {
        p.emit("connection.update", {
          isOnline: a === "available"
        });
        await B({
          tag: "presence",
          attrs: {
            name: c.name,
            type: a
          }
        });
      } else {
        l.warn("no name present, ignoring presence update request...");
      }
    } else {
      await B({
        tag: "chatstate",
        attrs: {
          from: c.id,
          to: b
        },
        content: [{
          tag: a === "recording" ? "composing" : a,
          attrs: a === "recording" ? {
            media: "audio"
          } : {}
        }]
      });
    }
  };
  const T = ({
    tag: a,
    attrs: b,
    content: c
  }) => {
    let g;
    const h = b.from;
    const k = b.participant || b.from;
    if (!X(h) || h === "@s.whatsapp.net") {
      if (a === "presence") {
        g = {
          lastKnownPresence: b.type === "unavailable" ? "unavailable" : "available",
          lastSeen: b.last && b.last !== "deny" ? +b.last : undefined
        };
      } else if (Array.isArray(c)) {
        [a] = c;
        b = a.tag;
        if (b === "paused") {
          b = "available";
        }
        if (a.attrs?.media === "audio") {
          b = "recording";
        }
        g = {
          lastKnownPresence: b
        };
      } else {
        l.error({
          tag: a,
          attrs: b,
          content: c
        }, "recv invalid presence node");
      }
      if (g) {
        p.emit("presence.update", {
          id: h,
          presences: {
            [k]: g
          }
        });
      }
    }
  };
  const U = async a => {
    const b = a.type;
    const c = e.creds.myAppStateKeyId;
    if (!c) {
      throw new boom_1.Boom("App state key not present!", {
        statusCode: 400
      });
    }
    let f;
    let g;
    await M.mutex(async () => {
      await e.keys.transaction(async () => {
        l.debug({
          patch: a
        }, "applying app patch");
        await H([b], false);
        var {
          [b]: h
        } = await e.keys.get("app-state-sync-version", [b]);
        f = h || (0, Utils_1.newLTHashState)();
        g = await (0, Utils_1.encodeSyncdPatch)(a, c, f, D);
        const {
          patch: k,
          state: n
        } = g;
        h = {
          tag: "iq",
          attrs: {
            to: WABinary_1.S_WHATSAPP_NET,
            type: "set",
            xmlns: "w:sync:app:state"
          },
          content: [{
            tag: "sync",
            attrs: {},
            content: [{
              tag: "collection",
              attrs: {
                name: b,
                version: (n.version - 1).toString(),
                return_snapshot: "false"
              },
              content: [{
                tag: "patch",
                attrs: {},
                content: WAProto_1.proto.SyncdPatch.encode(k).finish()
              }]
            }]
          }]
        };
        await r(h);
        await e.keys.set({
          "app-state-sync-version": {
            [b]: n
          }
        });
      });
    });
    if (m.emitOwnEvents) {
      const {
        onMutation: h
      } = R(false);
      const {
        mutationMap: k
      } = await (0, Utils_1.decodePatches)(b, [{
        ...g.patch,
        version: {
          version: g.state.version
        }
      }], f, D, m.options, undefined, l);
      for (const n in k) {
        h(k[n]);
      }
    }
  };
  const Z = async () => {
    var a;
    var c = await r({
      tag: "iq",
      attrs: {
        to: WABinary_1.S_WHATSAPP_NET,
        xmlns: "w",
        type: "get"
      },
      content: [{
        tag: "props",
        attrs: {
          protocol: "2",
          hash: ((a = e?.creds) === null || a === undefined ? undefined : a.lastPropHash) || ""
        }
      }]
    });
    a = (0, WABinary_1.getBinaryNodeChild)(c, "props");
    c = {};
    if (a) {
      e.creds.lastPropHash = a?.attrs?.hash;
      p.emit("creds.update", e.creds);
      c = (0, WABinary_1.reduceBinaryNodeToDictionary)(a, "prop");
    }
    l.debug("fetched props");
    return c;
  };
  const x = (a, b) => {
    a = (0, Utils_1.chatModificationToAppPatch)(a, b);
    return U(a);
  };
  const aa = async () => {
    await Promise.all([Z(), P(), N()]);
  };
  const ba = p.createBufferedFunction(async (a, b) => {
    async function c() {
      if (!e.creds.accountSyncCounter) {
        l.info("doing initial app state sync");
        await H(Types_1.ALL_WA_PATCH_NAMES, true);
        p.emit("creds.update", {
          accountSyncCounter: (e.creds.accountSyncCounter || 0) + 1
        });
        if (L) {
          l.debug("flushing with app state sync");
          p.flush();
        }
      }
    }
    var f;
    var h;
    p.emit("messages.upsert", {
      messages: [a],
      type: b
    });
    if (a.pushName) {
      b = a.key.fromMe ? e.creds.me.id : a.key.participant || a.key.remoteJid;
      b = (0, WABinary_1.jidNormalizedUser)(b);
      if (!a.key.fromMe) {
        p.emit("contacts.update", [{
          id: b,
          notify: a.pushName,
          verifiedName: a.verifiedBizName
        }]);
      }
      if (a.key.fromMe && a.pushName && ((f = e.creds.me) === null || f === undefined ? undefined : f.name) !== a.pushName) {
        p.emit("creds.update", {
          me: {
            ...e.creds.me,
            name: a.pushName
          }
        });
      }
    }
    const k = (0, Utils_1.getHistoryMsg)(a.message);
    f = k ? Y(k) && Defaults_1.PROCESSABLE_HISTORY_TYPES.includes(k.syncType) : false;
    if (k && !e.creds.myAppStateKeyId) {
      l.warn("skipping app state sync, as myAppStateKeyId is not set");
      C = true;
    }
    await Promise.all([(async () => {
      if (k && e.creds.myAppStateKeyId) {
        C = false;
        await c();
      }
    })(), (0, process_message_1.default)(a, {
      shouldProcessHistoryMsg: f,
      ev: p,
      creds: e.creds,
      keyStore: e.keys,
      logger: l,
      options: m.options,
      getMessage: m.getMessage
    })]);
    if (((h = a.message?.protocolMessage) === null || h === undefined ? 0 : h.appStateSyncKeyShare) && C) {
      await c();
      C = false;
    }
  });
  E.on("CB:presence", T);
  E.on("CB:chatstate", T);
  E.on("CB:ib,,dirty", async a => {
    const {
      attrs: b
    } = (0, WABinary_1.getBinaryNodeChild)(a, "dirty");
    switch (b.type) {
      case "account_sync":
        if (b.timestamp) {
          ({
            lastAccountSyncTimestamp: a
          } = e.creds);
          if (a) {
            await Q("account_sync", a);
          }
          a = +b.timestamp;
          p.emit("creds.update", {
            lastAccountSyncTimestamp: a
          });
        }
        break;
      case "groups":
        break;
      default:
        l.info({
          node: a
        }, "received unknown sync");
    }
  });
  p.on("connection.update", ({
    connection: a,
    receivedPendingNotifications: b
  }) => {
    var c;
    if (a === "open") {
      if (W) {
        aa().catch(f => K(f, "init queries"));
      }
      S(V ? "available" : "unavailable").catch(f => K(f, "presence update requests"));
    }
    if (!!b && ((c = e.creds) === null || c === undefined || !c.myAppStateKeyId) && !m.mobile) {
      p.buffer();
      L = true;
    }
  });
  return {
    ...J,
    processingMutex: M,
    fetchPrivacySettings: N,
    upsertMessage: ba,
    appPatch: U,
    sendPresenceUpdate: S,
    presenceSubscribe: (a, b) => B({
      tag: "presence",
      attrs: {
        to: a,
        id: F(),
        type: "subscribe"
      },
      content: b ? [{
        tag: "tctoken",
        attrs: {},
        content: b
      }] : undefined
    }),
    profilePictureUrl: async (a, b = "preview", c) => {
      a = (0, WABinary_1.jidNormalizedUser)(a);
      a = await r({
        tag: "iq",
        attrs: {
          target: a,
          to: WABinary_1.S_WHATSAPP_NET,
          type: "get",
          xmlns: "w:profile:picture"
        },
        content: [{
          tag: "picture",
          attrs: {
            type: b,
            query: "url"
          }
        }]
      }, c);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "picture");
      return a?.attrs?.url;
    },
    onWhatsApp: async (...a) => {
      a = a.map(b => ({
        tag: "user",
        attrs: {},
        content: [{
          tag: "contact",
          attrs: {},
          content: `+${b.replace("+", "")}`
        }]
      }));
      return (await O(a, {
        tag: "contact",
        attrs: {}
      })).map(b => {
        const c = (0, WABinary_1.getBinaryNodeChild)(b, "contact");
        return {
          exists: (c === null || c === undefined ? undefined : c.attrs.type) === "in",
          jid: b.attrs.jid
        };
      }).filter(b => b.exists);
    },
    fetchBlocklist: P,
    fetchStatus: async a => {
      [a] = await O([{
        tag: "user",
        attrs: {
          jid: a
        }
      }], {
        tag: "status",
        attrs: {}
      });
      if (a) {
        a = (0, WABinary_1.getBinaryNodeChild)(a, "status");
        return {
          status: a === null || a === undefined ? undefined : a.content.toString(),
          setAt: new Date(+((a === null || a === undefined ? undefined : a.attrs.t) || 0) * 1000)
        };
      }
    },
    updateProfilePicture: async (a, b) => {
      let c;
      if (!a) {
        throw new boom_1.Boom("Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update");
      }
      if ((0, WABinary_1.jidNormalizedUser)(a) !== (0, WABinary_1.jidNormalizedUser)(e.creds.me.id)) {
        c = (0, WABinary_1.jidNormalizedUser)(a);
      }
      ({
        img: a
      } = await (0, Utils_1.generateProfilePicture)(b));
      await r({
        tag: "iq",
        attrs: {
          target: c,
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          xmlns: "w:profile:picture"
        },
        content: [{
          tag: "picture",
          attrs: {
            type: "image"
          },
          content: a
        }]
      });
    },
    removeProfilePicture: async a => {
      let b;
      if (!a) {
        throw new boom_1.Boom("Illegal no-jid profile update. Please specify either your ID or the ID of the chat you wish to update");
      }
      if ((0, WABinary_1.jidNormalizedUser)(a) !== (0, WABinary_1.jidNormalizedUser)(e.creds.me.id)) {
        b = (0, WABinary_1.jidNormalizedUser)(a);
      }
      await r({
        tag: "iq",
        attrs: {
          target: b,
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          xmlns: "w:profile:picture"
        }
      });
    },
    updateProfileStatus: async a => {
      await r({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          xmlns: "status"
        },
        content: [{
          tag: "status",
          attrs: {},
          content: Buffer.from(a, "utf-8")
        }]
      });
    },
    updateProfileName: async a => {
      await x({
        pushNameSetting: a
      }, "");
    },
    updateBlockStatus: async (a, b) => {
      await r({
        tag: "iq",
        attrs: {
          xmlns: "blocklist",
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set"
        },
        content: [{
          tag: "item",
          attrs: {
            action: b,
            jid: a
          }
        }]
      });
    },
    updateLastSeenPrivacy: async a => {
      await y("last", a);
    },
    updateOnlinePrivacy: async a => {
      await y("online", a);
    },
    updateProfilePicturePrivacy: async a => {
      await y("profile", a);
    },
    updateStatusPrivacy: async a => {
      await y("status", a);
    },
    updateReadReceiptsPrivacy: async a => {
      await y("readreceipts", a);
    },
    updateGroupsAddPrivacy: async a => {
      await y("groupadd", a);
    },
    updateDefaultDisappearingMode: async a => {
      await r({
        tag: "iq",
        attrs: {
          xmlns: "disappearing_mode",
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set"
        },
        content: [{
          tag: "disappearing_mode",
          attrs: {
            duration: a.toString()
          }
        }]
      });
    },
    getBusinessProfile: async a => {
      var b;
      var f;
      var g;
      var h;
      var k;
      a = await r({
        tag: "iq",
        attrs: {
          to: "s.whatsapp.net",
          xmlns: "w:biz",
          type: "get"
        },
        content: [{
          tag: "business_profile",
          attrs: {
            v: "244"
          },
          content: [{
            tag: "profile",
            attrs: {
              jid: a
            }
          }]
        }]
      });
      a = (0, WABinary_1.getBinaryNodeChild)(a, "business_profile");
      if (a = (0, WABinary_1.getBinaryNodeChild)(a, "profile")) {
        const w = (0, WABinary_1.getBinaryNodeChild)(a, "address");
        const t = (0, WABinary_1.getBinaryNodeChild)(a, "description");
        var d = (0, WABinary_1.getBinaryNodeChild)(a, "website");
        const z = (0, WABinary_1.getBinaryNodeChild)(a, "email");
        const A = (0, WABinary_1.getBinaryNodeChild)((0, WABinary_1.getBinaryNodeChild)(a, "categories"), "category");
        const u = (0, WABinary_1.getBinaryNodeChild)(a, "business_hours");
        const q = u ? (0, WABinary_1.getBinaryNodeChildren)(u, "business_hours_config") : undefined;
        d = (b = d?.content) === null || b === undefined ? undefined : b.toString();
        return {
          wid: a.attrs?.jid,
          address: (f = w?.content) === null || f === undefined ? undefined : f.toString(),
          description: ((g = t?.content) === null || g === undefined ? undefined : g.toString()) || "",
          website: d ? [d] : [],
          email: (h = z?.content) === null || h === undefined ? undefined : h.toString(),
          category: (k = A?.content) === null || k === undefined ? undefined : k.toString(),
          business_hours: {
            timezone: u?.attrs?.timezone,
            business_config: q === null || q === undefined ? undefined : q.map(({
              attrs: v
            }) => v)
          }
        };
      }
    },
    resyncAppState: H,
    chatModify: x,
    cleanDirtyBits: Q,
    addChatLabel: (a, b) => x({
      addChatLabel: {
        labelId: b
      }
    }, a),
    removeChatLabel: (a, b) => x({
      removeChatLabel: {
        labelId: b
      }
    }, a),
    addMessageLabel: (a, b, c) => x({
      addMessageLabel: {
        messageId: b,
        labelId: c
      }
    }, a),
    removeMessageLabel: (a, b, c) => x({
      removeMessageLabel: {
        messageId: b,
        labelId: c
      }
    }, a),
    star: (a, b, c) => x({
      star: {
        messages: b,
        star: c
      }
    }, a)
  };
};
exports.makeChatsSocket = makeChatsSocket;
