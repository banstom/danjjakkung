const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const opts = ['A', 'B1', 'B2', 'C1', 'C2'];
  for (const theme of ['soft-pastel', 'cosmic-dream']) {
    for (const o of opts) {
      const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
      await p.goto('file://' + path.join(__dirname, 'index.html') + '?o=' + o + '&theme=' + theme);
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(300);
      // 긴 화면은 창을 내용 높이만큼 늘려서 찍는다 (아래 탭이 맨 아래에 붙게)
      const h = await p.evaluate(() => Math.max(844, document.querySelector('.app').scrollHeight + 100));
      await p.setViewportSize({ width: 390, height: h });
      await p.waitForTimeout(150);
      await p.screenshot({ path: path.join(__dirname, 'out', `${theme}-${o}.png`) });
      await p.close();
    }
  }
  await b.close();
})();
