/* ============================================================
   OSMO — Infinite Draggable Grid (embedded variant)
   ------------------------------------------------------------
   Adapted for Objects of Agency from osmo.supply's "Infinite
   Draggable Grid (Masonry)". Differences from the stock resource:
     • No CDN GSAP. Uses Webflow-native window.gsap + window.Observer
       (Observer ships with Webflow's GSAP via ScrollTrigger).
     • Wheel/scroll capture removed so the page keeps scrolling —
       this is a mid-page block, not a full-viewport takeover.
     • Touch axis-locked to horizontal via CSS `touch-action: pan-y`
       (oa-infinite-grid.css); vertical swipes scroll the page.
     • Slow idle auto-drift that pauses on hover, drag, and off-screen.
   Page-level embed (product template). Raw-served (no Rollup).
   ============================================================ */
function initInfiniteCardsGrid() {
  const Observer = window.Observer;
  if (!window.gsap || !Observer) {
    console.warn('[oa-infinite-grid] gsap/Observer unavailable — skipping init.');
    return;
  }
  gsap.registerPlugin(Observer); // no-op if Webflow already registered it

  const wrappers = document.querySelectorAll('[data-infinite-grid-init]');

  const dragSpeed = 1.2;                  // mouse drag speed
  const touchDragSpeed = 2.0;             // touch drag speed (snappier on mobile)
  const gridOverscan = 1;                 // extra rows/cols generated outside the viewport
  const startOffsetY = 0.33;              // vertical offset between columns
  const positionLerp = 0.05;              // movement smoothing amount
  const xToYInfluence = 0.2;              // horizontal drag influence on vertical movement
  const columnSpeedPattern = [1, 1, 0.9]; // column parallax speed pattern
  const minCardScale = 0.5;               // minimum card scale while dragging
  const scaleLerp = 0.02;                 // scale animation smoothing amount
  const driftX = -20;                     // idle auto-drift, px/s — mostly horizontal
  const driftY = -3;                      // faint vertical bias keeps column parallax alive

  // Mobile (≤767px) is a 2D-drag region: the grid owns touch (touch-action: none in
  // the CSS) and pans on both axes. Larger touch screens keep vertical for page scroll.
  const mobileMQ = window.matchMedia('(max-width: 767px)');

  wrappers.forEach((wrapper) => {
    const collection = wrapper.querySelector('[data-infinite-grid-collection]');
    const sourceList = wrapper.querySelector('[data-infinite-grid-list]');
    const originalItems = Array.from(sourceList.querySelectorAll('[data-infinite-grid-item]')).map((item) => item.cloneNode(true));

    if (!collection || !sourceList || !originalItems.length) return;

    let observer;
    let cards = [];
    let cardElements = [];
    const timers = {};
    const size = {};
    const pos = {};
    const scale = {current: 1, target: 1};

    // idle auto-drift state
    let isDragging = false;
    let inViewport = true;

    function setStatus(status) {
      wrapper.setAttribute('data-infinite-grid-status', status);
    }

    function wrapValue(value, size) {
      return ((value % size) + size) % size;
    }

    function createColumnSpeeds(columns) {
      return Array.from({length: columns}, (_, i) => columnSpeedPattern[i % columnSpeedPattern.length]);
    }

    function createItemIndexes(columns, rows) {
      const total = originalItems.length;
      const indexes = Array.from({length: rows}, () => []);
      const used = Array(total).fill(0);
      const centerColumn = Math.floor(columns / 2);
      const centerRow = Math.floor(rows / 2);
      const cells = [];

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          cells.push({
            row,
            column,
            distance: Math.abs(row - centerRow) + Math.abs(column - centerColumn)
          });
        }
      }

      cells.sort((a, b) => a.distance - b.distance);

      cells.forEach(({row, column}) => {
        const blocked = [
          indexes[row][column - 1],
          indexes[row][column + 1],
          row > 0 ? indexes[row - 1][column] : undefined,
          row < rows - 1 ? indexes[row + 1][column] : undefined,
          row > 0 ? indexes[row - 1][column - 1] : undefined,
          row > 0 ? indexes[row - 1][column + 1] : undefined,
          row < rows - 1 ? indexes[row + 1][column - 1] : undefined,
          row < rows - 1 ? indexes[row + 1][column + 1] : undefined
        ];

        const seed = (row * 17 + column * 31) % total;
        let bestIndex = 0;
        let bestScore = Infinity;

        for (let i = 0; i < total; i++) {
          const itemIndex = (i + seed) % total;
          let score = used[itemIndex] * 10 + Math.abs(itemIndex - seed) * 0.01;

          if (total > 1 && blocked.includes(itemIndex)) score += 1000;

          if (score < bestScore) {
            bestScore = score;
            bestIndex = itemIndex;
          }
        }

        indexes[row][column] = bestIndex;
        used[bestIndex]++;
      });

      return indexes;
    }

    function buildGrid() {
      if (observer) observer.kill();
      clearTimeout(timers.resize);
      clearTimeout(timers.scale);
      gsap.ticker.remove(updateGrid);

      setStatus('loading');
      sourceList.innerHTML = '';

      const measureItem = originalItems[0].cloneNode(true);
      measureItem.style.position = 'absolute';
      measureItem.style.visibility = 'hidden';
      measureItem.style.pointerEvents = 'none';
      wrapper.appendChild(measureItem);

      const rect = measureItem.getBoundingClientRect();
      size.itemW = rect.width;
      size.itemH = rect.height;
      measureItem.remove();

      if (!size.itemW || !size.itemH) return;

      const columns = Math.max(1, Math.ceil(wrapper.clientWidth / size.itemW) + gridOverscan * 2);
      const rows = Math.max(Math.ceil(wrapper.clientHeight / size.itemH) + gridOverscan * 2, Math.ceil(originalItems.length / columns));
      const itemIndexes = createItemIndexes(columns, rows);
      const columnSpeeds = createColumnSpeeds(columns);
      const fragment = document.createDocumentFragment();
      const centerColumn = Math.floor(columns / 2);
      const centerRow = Math.floor(rows / 2);

      size.totalW = columns * size.itemW;
      size.totalH = rows * size.itemH;
      cards = [];
      cardElements = [];

      gsap.set(collection, {x: 0, y: 0, force3D: true});

      collection.style.width = `${size.totalW}px`;
      collection.style.height = `${size.totalH}px`;

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const item = originalItems[itemIndexes[row][column]].cloneNode(true);
          const card = item.querySelector('[data-infinite-grid-card]');

          cards.push({
            baseX: column * size.itemW,
            baseY: row * size.itemH,
            startY: (column - centerColumn) * size.itemH * startOffsetY,
            ySpeed: columnSpeeds[column],
            xSetter: gsap.quickSetter(item, 'x', 'px'),
            ySetter: gsap.quickSetter(item, 'y', 'px')
          });

          if (card) cardElements.push(card);
          if (cards.length > originalItems.length) item.setAttribute('aria-hidden', 'true');

          fragment.appendChild(item);
        }
      }

      sourceList.appendChild(fragment);

      gsap.set(cardElements, {
        force3D: true
      });

      pos.startX = wrapper.clientWidth * 0.5 - centerColumn * size.itemW - size.itemW * 0.5;
      pos.startY = wrapper.clientHeight * 0.5 - centerRow * size.itemH - size.itemH * 0.5;
      pos.x = pos.startX;
      pos.y = pos.startY;
      pos.targetX = pos.x;
      pos.targetY = pos.y;
      scale.current = 1;
      scale.target = 1;

      updateGrid();
      gsap.ticker.add(updateGrid);

      requestAnimationFrame(() => {
        setStatus('idle');
      });

      observer = Observer.create({
        target: wrapper,
        type: 'touch,pointer',
        preventDefault: false,
        dragMinimum: 3,
        onPress() { isDragging = true; setStatus('dragging'); },
        onRelease() { isDragging = false; setStatus('idle'); },
        onStop() { isDragging = false; setStatus('idle'); },
        onChange: handleMovement
      });
    }

    function updateGrid(time, deltaTime) {
      if (!inViewport) return; // section off-screen — skip drift + per-card work

      if (!isDragging) {
        const dt = deltaTime ? Math.min(deltaTime / 1000, 0.05) : 0; // clamp tab-away jumps
        pos.targetX += driftX * dt;
        pos.targetY += driftY * dt;
      }

      pos.x += (pos.targetX - pos.x) * positionLerp;
      pos.y += (pos.targetY - pos.y) * positionLerp;
      scale.current += (scale.target - scale.current) * scaleLerp;

      const offsetX = size.itemW * gridOverscan;
      const offsetY = size.itemH * gridOverscan;
      const scrollY = pos.y - pos.startY;

      cards.forEach(({baseX, baseY, startY, ySpeed, xSetter, ySetter}) => {
        xSetter(wrapValue(baseX + pos.x + offsetX, size.totalW) - offsetX);
        ySetter(wrapValue(baseY + pos.startY + startY + scrollY * ySpeed + offsetY, size.totalH) - offsetY);
      });

      gsap.set(cardElements, {scale: scale.current});
    }

    function handleMovement(self) {
      const ev = self.event || {};
      const isTouch = ev.pointerType === 'touch' || (typeof ev.type === 'string' && ev.type.indexOf('touch') === 0);
      const speed = isTouch ? touchDragSpeed : dragSpeed;
      const limit = isTouch ? 120 : 80;
      const moveX = gsap.utils.clamp(-limit, limit, self.deltaX * speed);
      // Pan on Y for mouse and for mobile touch (2D-drag region, touch-action: none).
      // Larger touch screens reserve vertical for page scroll (touch-action: pan-y) → no Y pan.
      const panY = !isTouch || mobileMQ.matches;
      const moveY = panY ? gsap.utils.clamp(-limit, limit, self.deltaY * speed) : 0;
      const strength = gsap.utils.clamp(0, 1, Math.max(Math.abs(moveX), Math.abs(moveY)) / limit);

      scale.target = gsap.utils.interpolate(1, minCardScale, strength);

      clearTimeout(timers.scale);
      timers.scale = setTimeout(() => {
        scale.target = 1;
      }, 120);

      pos.targetX += moveX;
      pos.targetY += moveY + moveX * xToYInfluence;
    }

    function handleMouseLeave() {
      setStatus('idle');
      scale.target = 1;

      if (observer) {
        observer.disable();
        observer.enable();
      }
    }

    let lastWidth = window.innerWidth;
    window.addEventListener('resize', () => {
      // Mobile browsers fire resize on URL-bar show/hide (height-only) while you
      // scroll — rebuilding then resets the grid to its start position and can kill
      // a live touch mid-gesture (looked like "jump to first slide / drift locks").
      // Only rebuild when the WIDTH actually changes.
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(timers.resize);
      timers.resize = setTimeout(buildGrid, 200);
    });

    // Drift pauses only while actively dragging and when the section is scrolled
    // out of view (saves frames mid-page). Hover no longer pauses it.
    const viewportObserver = new IntersectionObserver((entries) => {
      inViewport = entries[0].isIntersecting;
    }, {threshold: 0});
    viewportObserver.observe(wrapper);

    document.documentElement.addEventListener('mouseleave', handleMouseLeave);

    buildGrid();
  });
}

// Initialize Infinite Cards Grid
document.addEventListener('DOMContentLoaded', () => {
  initInfiniteCardsGrid();
});
