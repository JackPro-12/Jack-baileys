var __importDefault = this && this.__importDefault || function (c) {
  if (c && c.__esModule) {
    return c;
  } else {
    return {
      default: c
    };
  }
};
Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extractCommunityMetadata = exports.makeCommunitiesSocket = undefined;
const WAProto_1 = require("../../WAProto");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const logger_1 = __importDefault(require("../Utils/logger"));
const WABinary_1 = require("../WABinary");
const business_1 = require("./business");
const makeCommunitiesSocket = c => {
  async function h(a) {
    logger_1.default.info({
      node: a
    }, "parseGroupResult");
    if (a = (0, WABinary_1.getBinaryNodeChild)(a, "group")) {
      try {
        logger_1.default.info({
          groupNode: a
        }, "groupNode");
        const b = await g.groupMetadata(`${a.attrs.id}@g.us`);
        if (b) {
          return b;
        } else {
          return p.empty();
        }
      } catch (b) {
        console.error("Error parsing group metadata:", b);
      }
    }
    return p.empty();
  }
  const g = (0, business_1.makeBusinessSocket)(c);
  const {
    authState: k,
    ev: l,
    query: m,
    upsertMessage: n
  } = g;
  const e = async (a, b, d) => m({
    tag: "iq",
    attrs: {
      type: b,
      xmlns: "w:g2",
      to: a
    },
    content: d
  });
  const q = async a => {
    a = await e(a, "get", [{
      tag: "query",
      attrs: {
        request: "interactive"
      }
    }]);
    return (0, exports.extractCommunityMetadata)(a);
  };
  const r = async () => {
    var a = await m({
      tag: "iq",
      attrs: {
        to: "@g.us",
        xmlns: "w:g2",
        type: "get"
      },
      content: [{
        tag: "participating",
        attrs: {},
        content: [{
          tag: "participants",
          attrs: {}
        }, {
          tag: "description",
          attrs: {}
        }]
      }]
    });
    const b = {};
    if (a = (0, WABinary_1.getBinaryNodeChild)(a, "communities")) {
      a = (0, WABinary_1.getBinaryNodeChildren)(a, "community");
      for (const d of a) {
        a = (0, exports.extractCommunityMetadata)({
          tag: "result",
          attrs: {},
          content: [d]
        });
        b[a.id] = a;
      }
    }
    g.ev.emit("groups.update", Object.values(b));
    return b;
  };
  const p = {
    empty: () => null,
    of: a => a !== null ? {
      value: a
    } : null
  };
  g.ws.on("CB:ib,,dirty", async a => {
    ({
      attrs: a
    } = (0, WABinary_1.getBinaryNodeChild)(a, "dirty"));
    if (a.type === "communities") {
      await r();
      await g.cleanDirtyBits("groups");
    }
  });
  return {
    ...g,
    communityMetadata: q,
    communityCreate: async (a, b) => {
      const d = (0, Utils_1.generateMessageID)().substring(0, 12);
      a = await e("@g.us", "set", [{
        tag: "create",
        attrs: {
          subject: a
        },
        content: [{
          tag: "description",
          attrs: {
            id: d
          },
          content: [{
            tag: "body",
            attrs: {},
            content: Buffer.from(b || "", "utf-8")
          }]
        }, {
          tag: "parent",
          attrs: {
            default_membership_approval_mode: "request_required"
          }
        }, {
          tag: "allow_non_admin_sub_group_creation",
          attrs: {}
        }, {
          tag: "create_general_chat",
          attrs: {}
        }]
      }]);
      return await h(a);
    },
    communityLeave: async a => {
      await e("@g.us", "set", [{
        tag: "leave",
        attrs: {},
        content: [{
          tag: "community",
          attrs: {
            id: a
          }
        }]
      }]);
    },
    communityUpdateSubject: async (a, b) => {
      await e(a, "set", [{
        tag: "subject",
        attrs: {},
        content: Buffer.from(b, "utf-8")
      }]);
    },
    communityRequestParticipantsList: async a => {
      a = await e(a, "get", [{
        tag: "membership_approval_requests",
        attrs: {}
      }]);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "membership_approval_requests");
      return (0, WABinary_1.getBinaryNodeChildren)(a, "membership_approval_request").map(b => b.attrs);
    },
    communityRequestParticipantsUpdate: async (a, b, d) => {
      a = await e(a, "set", [{
        tag: "membership_requests_action",
        attrs: {},
        content: [{
          tag: d,
          attrs: {},
          content: b.map(f => ({
            tag: "participant",
            attrs: {
              jid: f
            }
          }))
        }]
      }]);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "membership_requests_action");
      d = (0, WABinary_1.getBinaryNodeChild)(a, d);
      return (0, WABinary_1.getBinaryNodeChildren)(d, "participant").map(f => ({
        status: f.attrs.error || "200",
        jid: f.attrs.jid
      }));
    },
    communityParticipantsUpdate: async (a, b, d) => {
      a = await e(a, "set", [{
        tag: d,
        attrs: {},
        content: b.map(f => ({
          tag: "participant",
          attrs: {
            jid: f
          }
        }))
      }]);
      d = (0, WABinary_1.getBinaryNodeChild)(a, d);
      return (0, WABinary_1.getBinaryNodeChildren)(d, "participant").map(f => ({
        status: f.attrs.error || "200",
        jid: f.attrs.jid,
        content: f
      }));
    },
    communityUpdateDescription: async (a, b) => {
      const f = (await q(a)).descId ?? null;
      await e(a, "set", [{
        tag: "description",
        attrs: {
          ...(b ? {
            id: (0, Utils_1.generateMessageID)()
          } : {
            delete: "true"
          }),
          ...(f ? {
            prev: f
          } : {})
        },
        content: b ? [{
          tag: "body",
          attrs: {},
          content: Buffer.from(b, "utf-8")
        }] : undefined
      }]);
    },
    communityInviteCode: async a => {
      a = await e(a, "get", [{
        tag: "invite",
        attrs: {}
      }]);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "invite");
      if (a === null || a === undefined) {
        return undefined;
      } else {
        return a.attrs.code;
      }
    },
    communityRevokeInvite: async a => {
      a = await e(a, "set", [{
        tag: "invite",
        attrs: {}
      }]);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "invite");
      if (a === null || a === undefined) {
        return undefined;
      } else {
        return a.attrs.code;
      }
    },
    communityAcceptInvite: async a => {
      a = await e("@g.us", "set", [{
        tag: "invite",
        attrs: {
          code: a
        }
      }]);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "community");
      if (a === null || a === undefined) {
        return undefined;
      } else {
        return a.attrs.jid;
      }
    },
    communityRevokeInviteV4: async (a, b) => !!(await e(a, "set", [{
      tag: "revoke",
      attrs: {},
      content: [{
        tag: "participant",
        attrs: {
          jid: b
        }
      }]
    }])),
    communityAcceptInviteV4: l.createBufferedFunction(async (a, b) => {
      a = typeof a === "string" ? {
        remoteJid: a
      } : a;
      const f = await e(b.groupJid, "set", [{
        tag: "accept",
        attrs: {
          code: b.inviteCode,
          expiration: b.inviteExpiration.toString(),
          admin: a.remoteJid
        }
      }]);
      if (a.id) {
        b = WAProto_1.proto.Message.GroupInviteMessage.fromObject(b);
        b.inviteExpiration = 0;
        b.inviteCode = "";
        l.emit("messages.update", [{
          key: a,
          update: {
            message: {
              groupInviteMessage: b
            }
          }
        }]);
      }
      await n({
        key: {
          remoteJid: b.groupJid,
          id: (0, Utils_1.generateMessageIDV2)(g.user?.id),
          fromMe: false,
          participant: a.remoteJid
        },
        messageStubType: Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD,
        messageStubParameters: [k.creds.me.id],
        participant: a.remoteJid,
        messageTimestamp: (0, Utils_1.unixTimestampSeconds)()
      }, "notify");
      return f.attrs.from;
    }),
    communityGetInviteInfo: async a => {
      a = await e("@g.us", "get", [{
        tag: "invite",
        attrs: {
          code: a
        }
      }]);
      return (0, exports.extractCommunityMetadata)(a);
    },
    communityToggleEphemeral: async (a, b) => {
      await e(a, "set", [b ? {
        tag: "ephemeral",
        attrs: {
          expiration: b.toString()
        }
      } : {
        tag: "not_ephemeral",
        attrs: {}
      }]);
    },
    communitySettingUpdate: async (a, b) => {
      await e(a, "set", [{
        tag: b,
        attrs: {}
      }]);
    },
    communityMemberAddMode: async (a, b) => {
      await e(a, "set", [{
        tag: "member_add_mode",
        attrs: {},
        content: b
      }]);
    },
    communityJoinApprovalMode: async (a, b) => {
      await e(a, "set", [{
        tag: "membership_approval_mode",
        attrs: {},
        content: [{
          tag: "community_join",
          attrs: {
            state: b
          }
        }]
      }]);
    },
    communityFetchAllParticipating: r
  };
};
exports.makeCommunitiesSocket = makeCommunitiesSocket;
const extractCommunityMetadata = c => {
  var h;
  var g;
  c = (0, WABinary_1.getBinaryNodeChild)(c, "community");
  var k = (0, WABinary_1.getBinaryNodeChild)(c, "description");
  let l;
  let m;
  if (k) {
    l = (0, WABinary_1.getBinaryNodeChildString)(k, "body");
    m = k.attrs.id;
  }
  k = c.attrs.id.includes("@") ? c.attrs.id : (0, WABinary_1.jidEncode)(c.attrs.id, "g.us");
  const n = (h = (0, WABinary_1.getBinaryNodeChild)(c, "ephemeral")) === null || h === undefined ? undefined : h.attrs.expiration;
  h = (0, WABinary_1.getBinaryNodeChildString)(c, "member_add_mode") === "all_member_add";
  return {
    id: k,
    subject: c.attrs.subject,
    subjectOwner: c.attrs.s_o,
    subjectTime: +c.attrs.s_t,
    size: (0, WABinary_1.getBinaryNodeChildren)(c, "participant").length,
    creation: +c.attrs.creation,
    owner: c.attrs.creator ? (0, WABinary_1.jidNormalizedUser)(c.attrs.creator) : undefined,
    desc: l,
    descId: m,
    linkedParent: ((g = (0, WABinary_1.getBinaryNodeChild)(c, "linked_parent")) === null || g === undefined ? undefined : g.attrs.jid) || undefined,
    restrict: !!(0, WABinary_1.getBinaryNodeChild)(c, "locked"),
    announce: !!(0, WABinary_1.getBinaryNodeChild)(c, "announcement"),
    isCommunity: !!(0, WABinary_1.getBinaryNodeChild)(c, "parent"),
    isCommunityAnnounce: !!(0, WABinary_1.getBinaryNodeChild)(c, "default_sub_community"),
    joinApprovalMode: !!(0, WABinary_1.getBinaryNodeChild)(c, "membership_approval_mode"),
    memberAddMode: h,
    participants: (0, WABinary_1.getBinaryNodeChildren)(c, "participant").map(({
      attrs: e
    }) => ({
      id: e.jid,
      admin: e.type || null
    })),
    ephemeralDuration: n ? +n : undefined
  };
};
exports.extractCommunityMetadata = extractCommunityMetadata;
