/**
 * 极简 IndexedDB 封装（不引第三方库）
 * 用途：素材二进制（图片/音频）体积远大于 localStorage 的 5MB 上限，
 * 因此二进制放 IndexedDB，项目结构（story / layout / 素材元数据）放 localStorage。
 */

const DB_NAME = 'galgame-editor';
const DB_VERSION = 1;
const STORE_ASSETS = 'assets';

let dbPromise: Promise<IDBDatabase> | null = null;

/** 打开（或首次创建）数据库 */
function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_ASSETS)) {
        db.createObjectStore(STORE_ASSETS, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

/** 单个事务的通用包装 */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE_ASSETS, mode);
    const request = fn(tx.objectStore(STORE_ASSETS));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** 写入一条素材 */
export async function putAssetRecord(record: { id: string; dataUrl: string }): Promise<void> {
  await withStore('readwrite', (store) => store.put(record));
}

/** 读取一条素材 */
export async function getAssetRecord(id: string): Promise<{ id: string; dataUrl: string } | undefined> {
  return withStore('readonly', (store) => store.get(id) as IDBRequest<{ id: string; dataUrl: string } | undefined>);
}

/** 批量读取素材 */
export async function getAllAssetRecords(): Promise<{ id: string; dataUrl: string }[]> {
  return withStore('readonly', (store) => store.getAll() as IDBRequest<{ id: string; dataUrl: string }[]>);
}

/** 删除一条素材 */
export async function deleteAssetRecord(id: string): Promise<void> {
  await withStore('readwrite', (store) => store.delete(id));
}

/** 清空所有素材（新建项目时用） */
export async function clearAssetRecords(): Promise<void> {
  await withStore('readwrite', (store) => store.clear());
}
