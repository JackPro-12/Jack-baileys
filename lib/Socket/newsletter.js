Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.extractNewsletterMetadata = exports.makeNewsletterSocket = undefined;
const Types_1 = require("../Types");
const Utils_1 = require("../Utils");
const WABinary_1 = require("../WABinary");
const groups_1 = require("./groups");
const makeNewsletterSocket = m => {
  const d = (0, groups_1.makeGroupsSocket)(m);
  const {
    authState: n,
    signalRepository: p,
    query: g,
    generateMessageTag: h
  } = d;
  const q = new TextEncoder();
  const k = async (a, b, c) => g({
    tag: "iq",
    attrs: {
      id: h(),
      type: b,
      xmlns: "newsletter",
      to: a
    },
    content: c
  });
  const e = async (a, b, c) => g({
    tag: "iq",
    attrs: {
      id: h(),
      type: "get",
      xmlns: "w:mex",
      to: WABinary_1.S_WHATSAPP_NET
    },
    content: [{
      tag: "query",
      attrs: {
        query_id: b
      },
      content: q.encode(JSON.stringify({
        variables: {
          newsletter_id: a,
          ...c
        }
      }))
    }]
  });
  const v = async (a, b) => {
    let c;
    if (b === "messages") {
      c = (0, WABinary_1.getBinaryNodeChild)(a, "messages");
    } else {
      a = (0, WABinary_1.getBinaryNodeChild)(a, "message_updates");
      c = (0, WABinary_1.getBinaryNodeChild)(a, "messages");
    }
    return await Promise.all((0, WABinary_1.getAllBinaryNodeChildren)(c).map(async f => {
      var l;
      f.attrs.from = c === null || c === undefined ? undefined : c.attrs.jid;
      var r = parseInt(((l = (0, WABinary_1.getBinaryNodeChild)(f, "views_count")) === null || l === undefined ? undefined : l.attrs)?.count || "0");
      l = (0, WABinary_1.getBinaryNodeChild)(f, "reactions");
      l = (0, WABinary_1.getBinaryNodeChildren)(l, "reaction").map(({
        attrs: t
      }) => ({
        count: +t.count,
        code: t.code
      }));
      r = {
        server_id: f.attrs.server_id,
        views: r,
        reactions: l
      };
      if (b === "messages") {
        const {
          fullMessage: t,
          decrypt: w
        } = await (0, Utils_1.decryptMessageNode)(f, n.creds.me.id, n.creds.me.lid || "", p, m.logger);
        await w();
        r.message = t;
      }
      return r;
    }));
  };
  return {
    ...d,
    subscribeNewsletterUpdates: async a => {
      a = await k(a, "set", [{
        tag: "live_updates",
        attrs: {},
        content: []
      }]);
      return (0, WABinary_1.getBinaryNodeChild)(a, "live_updates")?.attrs;
    },
    newsletterReactionMode: async (a, b) => {
      await e(a, Types_1.QueryIds.JOB_MUTATION, {
        updates: {
          settings: {
            reaction_codes: {
              value: b
            }
          }
        }
      });
    },
    newsletterUpdateDescription: async (a, b) => {
      await e(a, Types_1.QueryIds.JOB_MUTATION, {
        updates: {
          description: b || "",
          settings: null
        }
      });
    },
    newsletterUpdateName: async (a, b) => {
      await e(a, Types_1.QueryIds.JOB_MUTATION, {
        updates: {
          name: b,
          settings: null
        }
      });
    },
    newsletterUpdatePicture: async (a, b) => {
      ({
        img: b
      } = await (0, Utils_1.generateProfilePicture)(b));
      await e(a, Types_1.QueryIds.JOB_MUTATION, {
        updates: {
          picture: b.toString("base64"),
          settings: null
        }
      });
    },
    newsletterRemovePicture: async a => {
      await e(a, Types_1.QueryIds.JOB_MUTATION, {
        updates: {
          picture: "",
          settings: null
        }
      });
    },
    newsletterUnfollow: async a => {
      await e(a, Types_1.QueryIds.UNFOLLOW);
    },
    newsletterFollow: async a => {
      await e(a, Types_1.QueryIds.FOLLOW);
    },
    newsletterUnmute: async a => {
      await e(a, Types_1.QueryIds.UNMUTE);
    },
    newsletterMute: async a => {
      await e(a, Types_1.QueryIds.MUTE);
    },
    newsletterAction: async (a, b) => {
      await e(a, b.toUpperCase());
    },
    newsletterCreate: async (a, b, c) => {
      await g({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          xmlns: "tos",
          id: h(),
          type: "set"
        },
        content: [{
          tag: "notice",
          attrs: {
            id: "20601218",
            stage: "5"
          },
          content: []
        }]
      });
      a = await e(undefined, Types_1.QueryIds.CREATE, {
        input: {
          name: a,
          description: b,
          settings: {
            reaction_codes: {
              value: c.toUpperCase()
            }
          }
        }
      });
      return (0, exports.extractNewsletterMetadata)(a, true);
    },
    newsletterMetadata: async (a, b, c) => {
      a = await e(undefined, Types_1.QueryIds.METADATA, {
        input: {
          key: b,
          type: a.toUpperCase(),
          view_role: c || "GUEST"
        },
        fetch_viewer_metadata: true,
        fetch_full_image: true,
        fetch_creation_time: true
      });
      return (0, exports.extractNewsletterMetadata)(a);
    },
    newsletterAdminCount: async a => {
      var c;
      a = await e(a, Types_1.QueryIds.ADMIN_COUNT);
      a = (c = (0, WABinary_1.getBinaryNodeChild)(a, "result")?.content) === null || c === undefined ? undefined : c.toString();
      return JSON.parse(a).data[Types_1.XWAPaths.ADMIN_COUNT].admin_count;
    },
    newsletterChangeOwner: async (a, b) => {
      await e(a, Types_1.QueryIds.CHANGE_OWNER, {
        user_id: b
      });
    },
    newsletterDemote: async (a, b) => {
      await e(a, Types_1.QueryIds.DEMOTE, {
        user_id: b
      });
    },
    newsletterDelete: async a => {
      await e(a, Types_1.QueryIds.DELETE);
    },
    newsletterReactMessage: async (a, b, c) => {
      await g({
        tag: "message",
        attrs: {
          to: a,
          ...(c ? {} : {
            edit: "7"
          }),
          type: "reaction",
          server_id: b,
          id: (0, Utils_1.generateMessageID)()
        },
        content: [{
          tag: "reaction",
          attrs: c ? {
            code: c
          } : {}
        }]
      });
    },
    newsletterFetchMessages: async (a, b, c, f) => {
      a = await k(WABinary_1.S_WHATSAPP_NET, "get", [{
        tag: "messages",
        attrs: {
          type: a,
          ...(a === "invite" ? {
            key: b
          } : {
            jid: b
          }),
          count: c.toString(),
          after: (f === null || f === undefined ? undefined : f.toString()) || "100"
        }
      }]);
      return await v(a, "messages");
    },
    newsletterFetchUpdates: async (a, b, c, f) => {
      a = await k(a, "get", [{
        tag: "message_updates",
        attrs: {
          count: b.toString(),
          after: (c === null || c === undefined ? undefined : c.toString()) || "100",
          since: (f === null || f === undefined ? undefined : f.toString()) || "0"
        }
      }]);
      return await v(a, "updates");
    }
  };
};
exports.makeNewsletterSocket = makeNewsletterSocket;
const extractNewsletterMetadata = (m, d) => {
  var p;
  m = (p = (0, WABinary_1.getBinaryNodeChild)(m, "result")?.content) === null || p === undefined ? undefined : p.toString();
  d = JSON.parse(m).data[d ? Types_1.XWAPaths.CREATE : Types_1.XWAPaths.NEWSLETTER];
  return {
    id: d.id,
    state: d.state.type,
    creation_time: +d.thread_metadata.creation_time,
    name: d.thread_metadata.name.text,
    nameTime: +d.thread_metadata.name.update_time,
    description: d.thread_metadata.description.text,
    descriptionTime: +d.thread_metadata.description.update_time,
    invite: d.thread_metadata.invite,
    handle: d.thread_metadata.handle,
    picture: d.thread_metadata.picture?.direct_path || null,
    preview: d.thread_metadata.preview?.direct_path || null,
    reaction_codes: d.thread_metadata?.settings?.reaction_codes?.value,
    subscribers: +d.thread_metadata.subscribers_count,
    verification: d.thread_metadata.verification,
    viewer_metadata: d.viewer_metadata
  };
};
exports.extractNewsletterMetadata = extractNewsletterMetadata;
