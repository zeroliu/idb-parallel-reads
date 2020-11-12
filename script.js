const writeBtn = document.getElementById('writeData');
const readsContainer = document.getElementById('reads');
const streamInput = document.getElementById('streamCount');
const withDataEl = document.getElementById('withData');
const withoutDataEl = document.getElementById('withoutData');

const DB_NAME = 'test_db';
const SHARD = 10000;

writeBtn.addEventListener('click', () => {
  writeData();
});
streamInput.addEventListener('input', () => {
  renderStreams();
})

function renderStreams() {
  const streams = streamInput.value;
  readsContainer.innerHTML = '';
  for (let i = 1; i <= streams; ++i) {
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

function generateString(sizeInKb) {
  return new Array(Math.floor((sizeInKb * 1024) / 4 + 1)).join('abcd');
}

async function writeData() {
  writeBtn.hidden = true;
  const writeStatusEl = document.getElementById('writeStatus');
  writeStatusEl.textContent = 'Generating test data...';
  const db = await openDb();
  const transaction = db.transaction('store', 'readwrite');
  const store = transaction.objectStore('store');
  const start = performance.now();
  let writeCount = 0;
  for (let i = 0; i < SHARD * 10; ++i) {
    const request = store.add(`data - ${i}: ${generateString(1)}`);
    request.onsuccess = () => {
      writeCount++;
      const progress = Math.round(writeCount / SHARD / 10 * 100);
      requestAnimationFrame(() => {
        writeStatusEl.textContent = `${progress}%`;
      });
    };
  }
  transaction.oncomplete = () => {
    console.log(
        `write completed. Took ${Math.round(performance.now() - start)}ms`);
    renderRead();
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

function isDbReady() {
  return new Promise(async (resolve) => {
    const db = await openDb();
    const transaction = db.transaction('store', 'readonly');
    const store = transaction.objectStore('store');
    const request = store.count();
    request.onsuccess = () => {
      if (request.result >= SHARD * 10) {
        resolve(true);
      } else {
        resolve(false);
      }
    }
  });
}

function renderRead() {
  withDataEl.hidden = false;
  withoutDataEl.hidden = true;
  renderStreams();
}

async function run() {
  if (!await isDbReady()) {
    withDataEl.hidden = true;
    withoutDataEl.hidden = false;
  } else {
    renderRead();
  }
}

run();
