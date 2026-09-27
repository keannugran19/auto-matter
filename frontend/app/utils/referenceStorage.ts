/**
 * Browser IndexedDB storage for default reference document.
 */

const DB_NAME = "auto_matter_db";
const STORE_NAME = "preferences";
const KEY_NAME = "default_reference";

interface StoredReference {
    blob: Blob;
    name: string;
    type: string;
    lastModified: number;
}

function openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        if (typeof window === "undefined" || !("indexedDB" in window)) {
            reject(new Error("IndexedDB not supported in this environment"));
            return;
        }

        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () =>
            reject(req.error || new Error("Failed to open IndexedDB"));
    });
}

export async function saveDefaultReference(file: File): Promise<void> {
    try {
        const db = await openDB();
        const data: StoredReference = {
            blob: file.slice(0, file.size, file.type),
            name: file.name,
            type:
                file.type ||
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            lastModified: file.lastModified || Date.now(),
        };

        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.put(data, KEY_NAME);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch (err) {
        console.warn("Failed to save default reference doc to IndexedDB:", err);
    }
}

export async function getDefaultReference(): Promise<File | null> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.get(KEY_NAME);
            req.onsuccess = () => {
                const res = req.result as StoredReference | undefined;
                if (!res || !res.blob) {
                    resolve(null);
                    return;
                }
                const restoredFile = new File([res.blob], res.name, {
                    type:
                        res.type ||
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    lastModified: res.lastModified,
                });
                resolve(restoredFile);
            };
            req.onerror = () => reject(req.error);
        });
    } catch {
        return null;
    }
}

export async function clearDefaultReference(): Promise<void> {
    try {
        const db = await openDB();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            const req = store.delete(KEY_NAME);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // Ignore failure
    }
}
