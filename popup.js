// default starting pet
const defaultPet = {
    hunger: 50,
    happiness: 100,
    statusMessage: "feed me!",
    growthStage: "baby",
    lastChecked: Date.now(),
    lastCommitCheck: Date.now(),
    totalCommits: 0
};

let pet = null;

document.addEventListener("DOMContentLoaded", () => {
    initializePet();
    console.log("popup loaded");
    console.log(Date.now().toString());
});

function initializePet() {
    chrome.storage.local.get(["pet"], async (result) => {
        if (!result.pet) {
            pet = defaultPet;
            console.log("created new pet!");
        } else {
            pet = result.pet;
            console.log("loaded existing pet");
        }
        applyDecay();
        await checkCommitsAndFeed();
        chrome.storage.local.set({ pet: pet }, () => {
            updateUI();
        });
    });
    console.log("initialized pet");
}

function applyDecay() {
    // now calc time since last checked and decrease hunger accordingly
    const currentTime = Date.now();
    const timeElapsed = currentTime - pet.lastChecked;
    const minutesElapsed = timeElapsed / (1000 * 60);
    // decreasing 2 hunger per hour = 2/60 = 0.033... hunger per minute
    // Using 15-minute intervals to prevent gaming the system
    const intervalsElapsed = Math.floor(minutesElapsed / 15); // 15-minute intervals
    // SETTING TO HIGH NUMBER FOR TESTING
    const hungerDecrease = intervalsElapsed * 0.5; // 0.5 hunger per 15 minutes (2 per hour)
    
    if (hungerDecrease > 0) {
        pet.hunger = Math.max(0, pet.hunger - hungerDecrease);
        pet.lastChecked = currentTime;
        console.log(`applied decay: -${hungerDecrease} hunger over ${intervalsElapsed} intervals (${Math.floor(minutesElapsed)} minutes)`);
    } else {
        console.log(`no decay applied: only ${Math.floor(minutesElapsed)} minutes elapsed`);
    }

    updateStatus();
}

function updateStatus() {
    // make status change based on hunger
    if (pet.hunger >= 80) {
        pet.statusMessage = "i'm stuffed!";
    } else if (pet.hunger >= 50) {
        pet.statusMessage = "i'm getting peckish...";
    } else if (pet.hunger >= 20) {
        pet.statusMessage = "feed me!!";
    } else {
        pet.statusMessage = "i'm starving!!!";
    }
    console.log(`updated status: ${pet.statusMessage}`);
}

// update progress bars and status message
function updateUI() {
    document.getElementById('hungerProgress').value = pet.hunger;
    document.getElementById('happinessProgress').value = pet.happiness;
    document.getElementById('statusMessage').textContent = pet.statusMessage;
    console.log("UI updated");
}

// hardcoded git user for now
const gitUser = "nicolajack";

// fetch git commits and update pet status accordingly
async function fetchGitCommits() {
    const response = await fetch(`https://api.github.com/users/${gitUser}/events`);
    if (response.ok) {
        console.log("fetched git commits");
        return response.json();
    }
    else {
        console.error('error fetching git commits: ', response);
    }
}

function countNewCommits(events){
    let newCommits = 0;
    for (const event of events) {
        if (event.type != "PushEvent") continue;
        
        // Safety check: ensure event has payload
        if (!event.payload) {
            continue;
        }

        const eventTime = new Date(event.created_at).getTime();
        
        // Only count commits that are newer than our last check
        if (eventTime > pet.lastCommitCheck) {
            // Check if commits array exists in payload
            if (event.payload.commits && Array.isArray(event.payload.commits)) {
                newCommits += event.payload.commits.length;
            } else {
                // For PushEvents without commits array, assume 1 commit
                newCommits += 1;
            }
        }
    }
    console.log(`counted new commits: ${newCommits}`);
    return newCommits;
}

const hungerPerCommit = 5;

// base happiness on streak, come back to this later

function feed(newCommits) {
    if (newCommits <= 0) return;

    pet.hunger = Math.min(100, pet.hunger + (hungerPerCommit * newCommits));
    pet.lastCommitCheck = Date.now();

    pet.totalCommits += newCommits;
    console.log(`fed pet: +${hungerPerCommit * newCommits} hunger from ${newCommits} new commits`);
    updateStatus();
}

async function checkCommitsAndFeed() {
    try {
        const events = await fetchGitCommits();
        if (!events) return;

        const newCommits = countNewCommits(events);
        feed(newCommits);
        updateStatus();
    } catch (error) {
        console.error('Error checking commits and feeding pet:', error);
        pet.statusMessage = "error fetching commits";
    }
}

