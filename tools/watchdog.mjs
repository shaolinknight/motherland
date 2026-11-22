// Fail a browser test run that has stopped making progress, instead of letting it sit until CI kills
// the whole job. Some page calls (page.evaluate on a promise the browser never settles) have no timeout
// of their own. The timer is unref'd, so a run that finishes normally exits as usual.
export function watchdog(name, minutes) {
  setTimeout(() => {
    console.log(`\n❌ ${name} made no progress for ${minutes} min and was stopped. The last ✓ above is where it hung.`);
    process.exit(1);
  }, minutes * 60e3).unref();
}
