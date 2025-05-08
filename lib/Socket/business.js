Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.makeBusinessSocket = undefined;
const business_1 = require("../Utils/business");
const WABinary_1 = require("../WABinary");
const generic_utils_1 = require("../WABinary/generic-utils");
const messages_recv_1 = require("./messages-recv");
const makeBusinessSocket = f => {
  const g = (0, messages_recv_1.makeMessagesRecvSocket)(f);
  const {
    authState: h,
    query: c,
    waUploadToServer: k
  } = g;
  return {
    ...g,
    logger: f.logger,
    getOrderDetails: async (a, b) => {
      a = await c({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "get",
          xmlns: "fb:thrift_iq",
          smax_id: "5"
        },
        content: [{
          tag: "order",
          attrs: {
            op: "get",
            id: a
          },
          content: [{
            tag: "image_dimensions",
            attrs: {},
            content: [{
              tag: "width",
              attrs: {},
              content: Buffer.from("100")
            }, {
              tag: "height",
              attrs: {},
              content: Buffer.from("100")
            }]
          }, {
            tag: "token",
            attrs: {},
            content: Buffer.from(b)
          }]
        }]
      });
      return (0, business_1.parseOrderDetailsNode)(a);
    },
    getCatalog: async ({
      jid: a,
      limit: b,
      cursor: d
    }) => {
      a = a || h.creds.me?.id;
      a = (0, WABinary_1.jidNormalizedUser)(a);
      b = [{
        tag: "limit",
        attrs: {},
        content: Buffer.from((b || 10).toString())
      }, {
        tag: "width",
        attrs: {},
        content: Buffer.from("100")
      }, {
        tag: "height",
        attrs: {},
        content: Buffer.from("100")
      }];
      if (d) {
        b.push({
          tag: "after",
          attrs: {},
          content: d
        });
      }
      a = await c({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "get",
          xmlns: "w:biz:catalog"
        },
        content: [{
          tag: "product_catalog",
          attrs: {
            jid: a,
            allow_shop_source: "true"
          },
          content: b
        }]
      });
      return (0, business_1.parseCatalogNode)(a);
    },
    getCollections: async (a, b = 51) => {
      a = a || h.creds.me?.id;
      a = (0, WABinary_1.jidNormalizedUser)(a);
      a = await c({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "get",
          xmlns: "w:biz:catalog",
          smax_id: "35"
        },
        content: [{
          tag: "collections",
          attrs: {
            biz_jid: a
          },
          content: [{
            tag: "collection_limit",
            attrs: {},
            content: Buffer.from(b.toString())
          }, {
            tag: "item_limit",
            attrs: {},
            content: Buffer.from(b.toString())
          }, {
            tag: "width",
            attrs: {},
            content: Buffer.from("100")
          }, {
            tag: "height",
            attrs: {},
            content: Buffer.from("100")
          }]
        }]
      });
      return (0, business_1.parseCollectionsNode)(a);
    },
    productCreate: async a => {
      a.isHidden = !!a.isHidden;
      a = await (0, business_1.uploadingNecessaryImagesOfProduct)(a, k);
      a = (0, business_1.toProductNode)(undefined, a);
      a = await c({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          xmlns: "w:biz:catalog"
        },
        content: [{
          tag: "product_catalog_add",
          attrs: {
            v: "1"
          },
          content: [a, {
            tag: "width",
            attrs: {},
            content: "100"
          }, {
            tag: "height",
            attrs: {},
            content: "100"
          }]
        }]
      });
      a = (0, generic_utils_1.getBinaryNodeChild)(a, "product_catalog_add");
      a = (0, generic_utils_1.getBinaryNodeChild)(a, "product");
      return (0, business_1.parseProductNode)(a);
    },
    productDelete: async a => {
      a = await c({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          xmlns: "w:biz:catalog"
        },
        content: [{
          tag: "product_catalog_delete",
          attrs: {
            v: "1"
          },
          content: a.map(b => ({
            tag: "product",
            attrs: {},
            content: [{
              tag: "id",
              attrs: {},
              content: Buffer.from(b)
            }]
          }))
        }]
      });
      a = (0, generic_utils_1.getBinaryNodeChild)(a, "product_catalog_delete");
      return {
        deleted: +((a === null || a === undefined ? undefined : a.attrs.deleted_count) || 0)
      };
    },
    productUpdate: async (a, b) => {
      b = await (0, business_1.uploadingNecessaryImagesOfProduct)(b, k);
      a = (0, business_1.toProductNode)(a, b);
      a = await c({
        tag: "iq",
        attrs: {
          to: WABinary_1.S_WHATSAPP_NET,
          type: "set",
          xmlns: "w:biz:catalog"
        },
        content: [{
          tag: "product_catalog_edit",
          attrs: {
            v: "1"
          },
          content: [a, {
            tag: "width",
            attrs: {},
            content: "100"
          }, {
            tag: "height",
            attrs: {},
            content: "100"
          }]
        }]
      });
      a = (0, generic_utils_1.getBinaryNodeChild)(a, "product_catalog_edit");
      a = (0, generic_utils_1.getBinaryNodeChild)(a, "product");
      return (0, business_1.parseProductNode)(a);
    }
  };
};
exports.makeBusinessSocket = makeBusinessSocket;
