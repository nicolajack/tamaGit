// default starting pet
const defaultPet = {
    hunger: 50,
    happiness: 100,
    statusMessage: "feed me!",
    growthStage: "egg",
    lastChecked: Date.now(),
    lastCommitCheck: Date.now(),
    totalCommits: 0
};

function determineGrowthStage(pet) {
    const previousStage = pet.growthStage;
    if ((pet.hunger === 0 || pet.totalCommits >= 300) && pet.growthStage !== "dead") {
        pet.growthStage = "dead";
    } else if (pet.totalCommits >= 100 && pet.growthStage === "baby") {
        pet.growthStage = "adult";
    } else if (pet.totalCommits >= 15 && pet.growthStage === "egg") {
        pet.growthStage = "baby";
    }

    if (previousStage !== pet.growthStage) {
        setGrowthStageMessage();
        console.log(`growth stage changed from ${previousStage} to ${pet.growthStage}`);
    }
}

// update sprite based on growth stage
function updateSprite() {
    const spriteElement = document.getElementById('sprite');
    switch (pet.growthStage) {
        case "egg":
            spriteElement.src = "images/egg.png";
            break;
        case "baby":
            spriteElement.src = "images/babykitty.png";
            break;
        case "adult":
            spriteElement.src = "images/normalkitty.png";
            break;
        case "dead":
            spriteElement.src = "images/deadkitty.png";
            break;
        default:
            console.warn(`Unknown growth stage: ${pet.growthStage}`);
            break;
    }
    console.log(`updated sprite to ${pet.growthStage}`);
}

// set growth stage status messages
function setGrowthStageMessage() {
    switch (pet.growthStage) {
        case "egg":
            pet.statusMessage = "waiting to hatch...";
            break;
        case "baby":
            pet.statusMessage = "goo goo ga ga!";
            break;
        case "adult":
            pet.statusMessage = "i feel older...";
            break;
        case "dead":
            pet.statusMessage = "rip...";
            break;
    }
}

let pet = null;

document.addEventListener("DOMContentLoaded", () => {
    initializePet();
    console.log("popup loaded");
    console.log(Date.now().toString());
});

function initializePet() {
    chrome.storage.local.get(["pet"], async (result) => {
        if (!result.pet) {
            pet = { ...defaultPet };
            console.log("created new pet!");
        } else {
            pet = result.pet;
            console.log("loaded existing pet");
        }
        console.log("total commits: " + pet.totalCommits);
        console.log("pet growth stage: " + pet.growthStage);
        
        applyDecay();
        await checkCommitsAndFeed();
        determineGrowthStage(pet);
        updateStatus(); // Update status after growth stage determination
        
        chrome.storage.local.set({ pet: pet }, () => {
            updateUI(); // This will now update sprite, progress bars, and status
            console.log("pet state saved and UI updated");
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
}

function updateStatus() {
    if (pet.growthStage === "dead") {
        pet.statusMessage = "rip...";
        return;
    }
    
    // Only update hunger-based status for egg stage
    // For other stages, preserve the growth stage messages unless the pet is very hungry
    if (pet.growthStage === "egg") {
        // make status change based on hunger for egg stage
        if (pet.hunger >= 80) {
            pet.statusMessage = "i'm stuffed!";
        } else if (pet.hunger >= 50) {
            pet.statusMessage = "i'm getting peckish...";
        } else if (pet.hunger >= 20) {
            pet.statusMessage = "feed me!!";
        } else {
            pet.statusMessage = "i'm starving!!!";
        }
    } else {
        // For baby and adult, only override with urgent hunger messages
        if (pet.hunger < 20) {
            pet.statusMessage = "i'm starving!!!";
        } else if (pet.hunger < 10) {
            pet.statusMessage = "feed me!!";
        }
        // Otherwise, keep the growth stage message
    }
    console.log(`updated status: ${pet.statusMessage}`);
}

// update progress bars, status message, and sprite
function updateUI() {
    document.getElementById('hungerProgress').value = pet.hunger;
    document.getElementById('happinessProgress').value = pet.happiness;
    document.getElementById('statusMessage').textContent = pet.statusMessage;
    updateSprite(); // Always update sprite when refreshing UI
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
    if (pet.growthStage === "dead") return;
    if (newCommits <= 0) return;

    pet.hunger = Math.min(100, pet.hunger + (hungerPerCommit * newCommits));
    pet.lastCommitCheck = Date.now();

    pet.totalCommits += newCommits;
    console.log(`fed pet: +${hungerPerCommit * newCommits} hunger from ${newCommits} new commits`);
}

async function checkCommitsAndFeed() {
    try {
        const events = await fetchGitCommits();
        if (!events) return;

        const newCommits = countNewCommits(events);
        feed(newCommits);
    } catch (error) {
        console.error('Error checking commits and feeding pet:', error);
        pet.statusMessage = "error fetching commits";
    }
}

// for testing: reset extension data
function resetExtension() {
    chrome.storage.local.clear(() => {
        console.log("extension data cleared!");
        location.reload();
    });
}

// uncomment the line below to reset on next popup open
// resetExtension();

