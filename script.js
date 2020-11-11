const writeBtn = document.getElementById('writeData');
const readsContainer = document.getElementById('reads');

const DB_NAME = 'test_db';
const SHARD = 10000;
const STREAMS = 5;

writeBtn.addEventListener('click', () => {
  writeData();
});

for (let i = 1; i <= STREAMS; ++i) {
  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = `
    <button class="read-btn">Read stream ${i}</button>
    <div class="speed">N/A</div>
    <div class="progress">N/A</div>
  `;
  readsContainer.appendChild(section);
  const readBtn = section.querySelector('.read-btn');
  readBtn.addEventListener('click', () => {
    readData(`stream ${i}`, (i - 1) * SHARD, i * SHARD, section);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore('store', {autoIncrement: true});
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

async function writeData() {
  console.log('Writing data to indexedDB...');
  const db = await openDb();
  const transaction = db.transaction('store', 'readwrite');
  const store = transaction.objectStore('store');
  const start = performance.now();
  for (let i = 0; i < 100000; ++i) {
    store.add(`data - ${i}`);
  }
  transaction.oncomplete = () => {
    console.log(
        `write completed. Took ${Math.round(performance.now() - start)}ms`);
  }
}

async function readData(name, startIndex, endIndex, section) {
  console.log(`Reading data from ${name}...`);
  const db = await openDb();
  const transaction = db.transaction('store', 'readonly');
  const store = transaction.objectStore('store');
  const start = performance.now();
  const speedEl = section.querySelector('.speed');
  const progressEl = section.querySelector('.progress');
  readDataInternal(startIndex, endIndex, store, start, speedEl, progressEl);
  transaction.oncomplete = () => {
    const now = performance.now();
    console.log(
        `Read from ${startIndex} completed. Took ${Math.round(now - start)}ms`);
    const speed = (now - start) / (endIndex - startIndex);
    speedEl.textContent = `${speed.toFixed(2)} ms/request`;
  }
}

function readDataInternal(
    currentIndex, endIndex, store, startMs, speedEl, progressEl,
    requestCount = 1) {
  if (currentIndex >= endIndex) {
    return;
  }
  if (requestCount % 100 === 0) {
    const speed = (performance.now() - startMs) / 100;
    speedEl.textContent = `${speed.toFixed(2)} ms/request`;
    startMs = performance.now();
  }
  const progress = Math.round(requestCount / SHARD * 100);
  progressEl.textContent = `${progress}%`;
  const request = store.get(currentIndex);
  request.onsuccess = () => {
    readDataInternal(
        currentIndex + 1, endIndex, store, startMs, speedEl, progressEl,
        requestCount + 1);
  };
}
