chrome.runtime.onInstalled.addListener(() => {
    chrome.alarms.create("decayAlarm", { periodInMinutes: 60 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "decayAlarm") {
        applyBackgroundDecay();
    }
});

function applyBackgroundDecay() {
    chrome.storage.local.get(["pet"], (result) => {
        if (!result.pet) return;

    let pet = result.pet;
    let time = Date.now();
    let elapsed = time - pet.lastChecked;
    let hours = elapsed / (1000 * 60 * 60);
    let hungerDecrease = Math.floor(hours) * 2;
    pet.hunger = Math.max(0, pet.hunger - hungerDecrease);
    pet.lastChecked = time;

    chrome.storage.local.set({ pet: pet }, () => {
        console.log(`Background decay applied: -${hungerDecrease} hunger over ${Math.floor(hours)} hours`);
    });
});
}