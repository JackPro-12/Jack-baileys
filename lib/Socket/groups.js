Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extractGroupMetadata = exports.makeGroupsSocket = undefined;
const WAProto_1 = require("../../WAProto");
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const chats_1 = require("./chats");
const makeGroupsSocket = c => {
  const g = (0, chats_1.makeChatsSocket)(c);
  const {
    authState: k,
    ev: h,
    query: l,
    upsertMessage: n
  } = g;
  const e = async (a, b, d) => l({
    tag: "iq",
    attrs: {
      type: b,
      xmlns: "w:g2",
      to: a
    },
    content: d
  });
  const m = async a => {
    a = await e(a, "get", [{
      tag: "query",
      attrs: {
        request: "interactive"
      }
    }]);
    return (0, exports.extractGroupMetadata)(a);
  };
  const p = async () => {
    var a = await l({
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
    if (a = (0, WABinary_1.getBinaryNodeChild)(a, "groups")) {
      a = (0, WABinary_1.getBinaryNodeChildren)(a, "group");
      for (const d of a) {
        a = (0, exports.extractGroupMetadata)({
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
  g.ws.on("CB:ib,,dirty", async a => {
    ({
      attrs: a
    } = (0, WABinary_1.getBinaryNodeChild)(a, "dirty"));
    if (a.type === "groups") {
      await p();
      await g.cleanDirtyBits("groups");
    }
  });
  return {
    ...g,
    groupMetadata: m,
    groupCreate: async (a, b) => {
      const d = (0, Utils_1.generateMessageID)();
      a = await e("@g.us", "set", [{
        tag: "create",
        attrs: {
          subject: a,
          key: d
        },
        content: b.map(f => ({
          tag: "participant",
          attrs: {
            jid: f
          }
        }))
      }]);
      return (0, exports.extractGroupMetadata)(a);
    },
    groupLeave: async a => {
      await e("@g.us", "set", [{
        tag: "leave",
        attrs: {},
        content: [{
          tag: "group",
          attrs: {
            id: a
          }
        }]
      }]);
    },
    groupUpdateSubject: async (a, b) => {
      await e(a, "set", [{
        tag: "subject",
        attrs: {},
        content: Buffer.from(b, "utf-8")
      }]);
    },
    groupRequestParticipantsList: async a => {
      a = await e(a, "get", [{
        tag: "membership_approval_requests",
        attrs: {}
      }]);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "membership_approval_requests");
      return (0, WABinary_1.getBinaryNodeChildren)(a, "membership_approval_request").map(b => b.attrs);
    },
    groupRequestParticipantsUpdate: async (a, b, d) => {
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
    groupParticipantsUpdate: async (a, b, d) => {
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
    groupUpdateDescription: async (a, b) => {
      const f = (await m(a)).descId ?? null;
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
    groupInviteCode: async a => {
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
    groupRevokeInvite: async a => {
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
    groupAcceptInvite: async a => {
      a = await e("@g.us", "set", [{
        tag: "invite",
        attrs: {
          code: a
        }
      }]);
      a = (0, WABinary_1.getBinaryNodeChild)(a, "group");
      if (a === null || a === undefined) {
        return undefined;
      } else {
        return a.attrs.jid;
      }
    },
    groupAcceptInviteV4: h.createBufferedFunction(async (a, b) => {
      a = typeof a === "string" ? {
        remoteJid: a
      } : a;
      const d = await e(b.groupJid, "set", [{
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
        h.emit("messages.update", [{
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
          id: (0, Utils_1.generateMessageID)(),
          fromMe: false,
          participant: a.remoteJid
        },
        messageStubType: Types_1.WAMessageStubType.GROUP_PARTICIPANT_ADD,
        messageStubParameters: [k.creds.me.id],
        participant: a.remoteJid,
        messageTimestamp: (0, Utils_1.unixTimestampSeconds)()
      }, "notify");
      return d.attrs.from;
    }),
    groupGetInviteInfo: async a => {
      a = await e("@g.us", "get", [{
        tag: "invite",
        attrs: {
          code: a
        }
      }]);
      return (0, exports.extractGroupMetadata)(a);
    },
    groupToggleEphemeral: async (a, b) => {
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
    groupSettingUpdate: async (a, b) => {
      await e(a, "set", [{
        tag: b,
        attrs: {}
      }]);
    },
    groupMemberAddMode: async (a, b) => {
      await e(a, "set", [{
        tag: "member_add_mode",
        attrs: {},
        content: b
      }]);
    },
    groupJoinApprovalMode: async (a, b) => {
      await e(a, "set", [{
        tag: "membership_approval_mode",
        attrs: {},
        content: [{
          tag: "group_join",
          attrs: {
            state: b
          }
        }]
      }]);
    },
    groupFetchAllParticipating: p
  };
};
exports.makeGroupsSocket = makeGroupsSocket;
const extractGroupMetadata = c => {
  var g;
  var k;
  c = (0, WABinary_1.getBinaryNodeChild)(c, "group");
  var h = (0, WABinary_1.getBinaryNodeChild)(c, "description");
  let l;
  let n;
  if (h) {
    l = (0, WABinary_1.getBinaryNodeChildString)(h, "body");
    n = h.attrs.id;
  }
  h = c.attrs.id.includes("@") ? c.attrs.id : (0, WABinary_1.jidEncode)(c.attrs.id, "g.us");
  const e = (g = (0, WABinary_1.getBinaryNodeChild)(c, "ephemeral")) === null || g === undefined ? undefined : g.attrs.expiration;
  g = (0, WABinary_1.getBinaryNodeChildString)(c, "member_add_mode") === "all_member_add";
  return {
    id: h,
    subject: c.attrs.subject,
    subjectOwner: c.attrs.s_o,
    subjectTime: +c.attrs.s_t,
    size: (0, WABinary_1.getBinaryNodeChildren)(c, "participant").length,
    creation: +c.attrs.creation,
    owner: c.attrs.creator ? (0, WABinary_1.jidNormalizedUser)(c.attrs.creator) : undefined,
    desc: l,
    descId: n,
    linkedParent: ((k = (0, WABinary_1.getBinaryNodeChild)(c, "linked_parent")) === null || k === undefined ? undefined : k.attrs.jid) || undefined,
    restrict: !!(0, WABinary_1.getBinaryNodeChild)(c, "locked"),
    announce: !!(0, WABinary_1.getBinaryNodeChild)(c, "announcement"),
    isCommunity: !!(0, WABinary_1.getBinaryNodeChild)(c, "parent"),
    isCommunityAnnounce: !!(0, WABinary_1.getBinaryNodeChild)(c, "default_sub_group"),
    joinApprovalMode: !!(0, WABinary_1.getBinaryNodeChild)(c, "membership_approval_mode"),
    memberAddMode: g,
    participants: (0, WABinary_1.getBinaryNodeChildren)(c, "participant").map(({
      attrs: m
    }) => ({
      id: m.jid,
      admin: m.type || null
    })),
    ephemeralDuration: e ? +e : undefined
  };
};
exports.extractGroupMetadata = extractGroupMetadata;
