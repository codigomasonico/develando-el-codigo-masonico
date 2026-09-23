import { getStore } from "@netlify/blobs";

const STORE_NAME = "book-orders-v1";
const ORDER_PREFIX = "order/";
const LOCK_PREFIX = "shipment-lock/";
const LOCK_TTL_MS = 5 * 60 * 1000;

function getOrderStore() {
  return getStore(STORE_NAME);
}

function normalizeReference(value) {
  return String(value || "").trim().toUpperCase();
}

function orderKey(reference) {
  const ref = normalizeReference(reference);

  if (!/^CAM-\d{6}-[A-Z]{3}\d{5}$/.test(ref)) {
    throw new Error("Referencia de pedido inválida.");
  }

  return `${ORDER_PREFIX}${ref}`;
}

function isLocalStrongConsistencyError(error) {
  return (
    error?.name === "BlobsConsistencyError" ||
    String(error?.message || "").includes("uncachedEdgeURL")
  );
}

async function getJson(store, key) {
  try {
    return await store.get(key, {
      type: "json",
      consistency: "strong"
    });
  } catch (error) {
    if (!isLocalStrongConsistencyError(error)) {
      throw error;
    }

    // Netlify Dev sandbox may not expose uncachedEdgeURL for Lambda-compatible
    // functions. In that exact local-only case, retry with the default model.
    return store.get(key, {
      type: "json"
    });
  }
}

async function createOrder(order) {
  const store = getOrderStore();
  const key = orderKey(order.reference);

  const created = await store.setJSON(key, order, { onlyIfNew: true });

  if (created?.modified) {
    return order;
  }

  const existing = await getJson(store, key);

  if (!existing) {
    throw new Error("No se pudo guardar el pedido.");
  }

  return existing;
}

async function getOrder(reference) {
  const store = getOrderStore();
  return getJson(store, orderKey(reference));
}

async function saveOrder(order) {
  const store = getOrderStore();

  order.updatedAt = new Date().toISOString();
  await store.setJSON(orderKey(order.reference), order);

  return order;
}

async function listOrders() {
  const store = getOrderStore();
  const { blobs } = await store.list({ prefix: ORDER_PREFIX });

  const orders = await Promise.all(
    blobs.map(({ key }) => getJson(store, key))
  );

  return orders
    .filter(Boolean)
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    );
}

async function acquireShipmentLock(reference) {
  const store = getOrderStore();
  const ref = normalizeReference(reference);
  const key = `${LOCK_PREFIX}${ref}`;

  const existing = await getJson(store, key);

  if (existing?.createdAt) {
    const age = Date.now() - Date.parse(existing.createdAt);

    if (Number.isFinite(age) && age < LOCK_TTL_MS) {
      return false;
    }

    await store.delete(key);
  }

  const created = await store.setJSON(
    key,
    {
      reference: ref,
      createdAt: new Date().toISOString()
    },
    { onlyIfNew: true }
  );

  return Boolean(created?.modified);
}

async function releaseShipmentLock(reference) {
  const store = getOrderStore();
  await store.delete(`${LOCK_PREFIX}${normalizeReference(reference)}`);
}

export {
  createOrder,
  getOrder,
  saveOrder,
  listOrders,
  acquireShipmentLock,
  releaseShipmentLock,
  normalizeReference
};
