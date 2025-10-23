
import { logger } from './logger.js';

const DB_NAME = 'shot_history';
const DB_VERSION = 2;
const STORE_NAME = 'shots';

let db;

export function openDB() {
    return new Promise((resolve, reject) => {
        if (!('indexedDB' in window)) {
            logger.error('IndexedDB is not supported in this browser.');
            return reject('IndexedDB not supported.');
        }

        if (db) {
            return resolve(db);
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            logger.error('IndexedDB error:', event.target.error);
            reject('Error opening IndexedDB.');
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            logger.info('IndexedDB opened successfully.');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (db.objectStoreNames.contains(STORE_NAME)) {
                db.deleteObjectStore(STORE_NAME);
            }
            db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        };
    });
}

export function addShot(shot) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB not open');
        }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(shot);

        request.onsuccess = () => {
            logger.info('Shot added to IndexedDB');
            resolve();
        };

        request.onerror = (event) => {
            logger.error('Error adding shot to IndexedDB:', event.target.error);
            reject('Error adding shot.');
        };
    });
}

export function getAllShots() {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB not open');
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = (event) => {
            resolve(event.target.result);
            logger.info("getAllShots success")
        };

        request.onerror = (event) => {
            logger.error('Error getting all shots from IndexedDB:', event.target.error);
            reject('Error getting shots.');
        };
    });
}

export function getLatestShotTimestamp() {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB not open');
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const cursorRequest = store.openCursor(null, 'prev');

        let latestTimestamp = 0;

        cursorRequest.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                latestTimestamp = cursor.value.timestamp;
                resolve(latestTimestamp);
            } else {
                resolve(null); // No shots in the database
            }
        };

        cursorRequest.onerror = (event) => {
            logger.error('Error getting latest shot timestamp:', event.target.error);
            reject('Error getting latest shot timestamp.');
        };
    });
}

export function getShot(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB not open');
        }
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            logger.error('Error getting shot from IndexedDB:', event.target.error);
            reject('Error getting shot.');
        };
    });
}

export function deleteShot(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB not open');
        }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => {
            logger.info('Shot deleted from IndexedDB');
            resolve();
        };

        request.onerror = (event) => {
            logger.error('Error deleting shot from IndexedDB:', event.target.error);
            reject('Error deleting shot.');
        };
    });
}

export function clearShots() {
    return new Promise((resolve, reject) => {
        if (!db) {
            return reject('DB not open');
        }
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = () => {
            logger.info('Shot history cleared from IndexedDB');
            resolve();
        };

        request.onerror = (event) => {
            logger.error('Error clearing shot history from IndexedDB:', event.target.error);
            reject('Error clearing shot history.');
        };
    });
}
