let apikey;
let membernames;
const display_defends=false;
const our_faction_id = 35840;
let details = {};

let db;
const dbName = "ChainVisualCache";
const storeNames = {
  chains: "chains",
  details: "details",
  members: "members"
};

function toName(id) {
  return membernames?.[id]?.name || id;
}

async function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, 2);

    request.onerror = () => {
      console.error("IndexedDB failed to open.");
      reject("Failed to open DB");
    };

    request.onupgradeneeded = event => {
      const db = event.target.result;
      console.log("Running onupgradeneeded...");

      if (!db.objectStoreNames.contains(storeNames.chains)) {
        db.createObjectStore(storeNames.chains, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(storeNames.details)) {
        db.createObjectStore(storeNames.details, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(storeNames.members)) {
        db.createObjectStore(storeNames.members, { keyPath: "id" });
      }
    };

    request.onsuccess = async event => {
      db = event.target.result;
      console.log("Database opened successfully.");

      // Initialize global objects
      await loadAllData();  // This loads data into global `details`, `members`, and `chains`
      document.body.style.visibility = 'visible';
      resolve(db);
    };
  });
}

// Load all necessary data into global objects
async function loadAllData() {
  // Load data from IndexedDB into global objects
  members = await loadAllMembersFromIndexedDB();
  chains = await loadAllChainsFromIndexedDB();
  details = await loadAllDetailsFromIndexedDB();
}

// Helper to load all chains into the global `chains` object
async function loadAllChainsFromIndexedDB() {
  const chains = await loadFromIndexedDB(storeNames.chains, 'all');
  return chains || {};  // Return empty object if no chains
}

// Helper to load all details into the global `details` object
async function loadAllDetailsFromIndexedDB() {
  const details = await loadFromIndexedDB(storeNames.details, 'all');
  return details || {};  // Return empty object if no details
}


async function loadDataToDetails(store, id) {
  const data = await loadFromIndexedDB(store, id);
  if (data) {
    details[store] = details[store] || {};  // Initialize if not already
    details[store][id] = data;  // Store data in the `details` object using the ID
  }
}


async function loadDataForCID(cid) {
  // Load chains and details data
  await loadDataToDetails('chains', cid);
  await loadDataToDetails('details', cid);
}



function checkKeyExists(storeName, key) {
  return new Promise((resolve) => {
    if (!db) return resolve(false);
    const tx = db.transaction(storeName, "readonly");
    const store = tx.objectStore(storeName);
    const req = store.getKey(key);

    req.onsuccess = () => {
      resolve(req.result !== undefined); // If no key is found, `req.result` will be undefined
    };

    req.onerror = () => {
      resolve(false);
    };
  });
}

function saveToIndexedDB(store, value) {
  if (!db) return;
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
}

/*function loadFromIndexedDB(store, id) {
  return new Promise((resolve) => {
    if (!db) return resolve(null);
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}*/

async function loadFromIndexedDB(store, id) {
  // Ensure the DB is open before trying to load data
  if (!db) {
    console.log("DB not open, attempting to open...");
    await openDB();  // Make sure DB is open before proceeding
  }

  return new Promise((resolve) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}


function loadAllMembersFromIndexedDB() {
  return new Promise((resolve, reject) => {
    if (!db) return resolve({}); // empty if no db yet

    const tx = db.transaction(storeNames.members, "readonly");
    const store = tx.objectStore(storeNames.members);
    const req = store.getAll();

    req.onsuccess = () => {
      // Convert array of members to {id: {name, active}, ...}
      const members = {};
      req.result.forEach(m => {
        members[m.id] = { name: m.name, active: m.active };
      });
      resolve(members);
    };

    req.onerror = () => resolve({});
  });
}

function saveMembersToIndexedDB(membersObj) {
  if (!db) return;

  const tx = db.transaction(storeNames.members, "readwrite");
  const store = tx.objectStore(storeNames.members);

  for (const id in membersObj) {
    store.put({ id: Number(id), name: membersObj[id].name, active: membersObj[id].active });
  }
}


function TCT(unixEpoch) {
   const date = new Date(unixEpoch * 1000);
   const options = {
     timeZone: 'Europe/London',
     day: '2-digit',
     month: '2-digit',
     hour: '2-digit',
     minute: '2-digit',
     hour12: false
   };
   const formatter = new Intl.DateTimeFormat('en-GB', options);
   const parts = formatter.formatToParts(date);
   const day = parts.find(p => p.type === 'day').value;
   const month = parts.find(p => p.type === 'month').value;
   const hour = parts.find(p => p.type === 'hour').value;
   const minute = parts.find(p => p.type === 'minute').value;
   return `${day}.${month} - ${hour}:${minute}`;
}

function formatDuration(startEpoch, endEpoch) {
  const seconds = endEpoch - startEpoch;
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let result = '';
  if (days > 0) result += `${days}d `;
  if (hours > 0 || days > 0) result += `${hours}h `;
  if (minutes > 0 || hours > 0 || days > 0) result += `${minutes}m `;
  result += `${secs}s`;

  return result.trim();
}

function formatHHMM(seconds) {
  const totalMinutes = Math.floor(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function formatMMSS(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function toggle(id,which) {
	console.log(`Running toggle(${id},${which})`);
	const target = document.getElementById(id);
	console.log(`Target element: ${target}`);
	const subtarget = target.querySelector(`#${which}`);
	console.log(`Subtarget element: ${subtarget}`);
	target.querySelector('#display-torn').style.display = "none";
	target.querySelector('#display-detailed').style.display = "none";
	target.querySelector('#display-timeline').style.display = "none";
	subtarget.style.display = "";
}

async function API_submit() {
     apikey = document.querySelector('#api_key_input').value;
     const apiresponse = await try_fetch_API_chain_list();
	 membernames = await try_fetch_API_member_list(); // or loadAllMembersFromIndexedDB()


     try {
       if (apiresponse) {
         generate_chain_list(apiresponse);
       } else {
         document.querySelector('#api_response_message').innerHTML = "Failed to load data (no response).";
       }
     } catch (err) {
       console.error('Error generating chain list:', err);
       document.querySelector('#api_response_message').innerHTML = "Failed to render chain list.";
     }
}

async function try_fetch_API_member_list() {
  console.log("Requesting API for member list");
  const url = "https://api.torn.com/v2/faction/members?striptags=false&key=" + apikey +"&comment=ChainVisual";

  try {
    const response = await fetch(url);
    if (!response.ok) {
      document.querySelector('#api_response_message').innerHTML = "Network response not okay";
      return null;
    }
    const data = await response.json();
    console.log('Data received:', data);

    // Load existing cached members
    const cachedMembers = await loadAllMembersFromIndexedDB();

    // Mark all cached members inactive initially
    Object.keys(cachedMembers).forEach(id => {
      cachedMembers[id].active = false;
    });

    // Update cache with fresh API data
    for (const member of data.members) {
      cachedMembers[member.id] = { name: member.name, active: true };
    }

    // Save updated cache back
    saveMembersToIndexedDB(cachedMembers);

    return cachedMembers;  // Return the updated cache object

  } catch (error) {
    console.error('There was a problem with the fetch operation:', error);
    return null;
  }
}

   
async function try_fetch_API_chain_list() {
   console.log("Requesting API for chain list");
   const url = "https://api.torn.com/v2/faction/chains?limit=100&sort=DESC&key=" + apikey +"&comment=ChainVisual";

   try {
     const response = await fetch(url);
     if (!response.ok) {
       document.querySelector('#api_response_message').innerHTML = "Network response not okay";
       return null;
     }
     const data = await response.json();
     console.log('Data received:', data);
     return data;
   } catch (error) {
     console.error('There was a problem with the fetch operation:', error);
     return null;
   }
}

async function try_fetch_API_chain(chainid) {
  const cached = await loadFromIndexedDB(storeNames.chains, chainid);
  if (cached) {
    console.log("Loaded chain report from cache:", chainid);
    return cached;
  }

  console.log("Requesting API for chain id " + chainid);
  const url = `https://api.torn.com/v2/faction/${chainid}/chainreport?key=${apikey}&comment=ChainVisual`;
  await new Promise(resolve => setTimeout(resolve, 3000));

  try {
    const response = await fetch(url);
    if (!response.ok) {
      document.querySelector('#api_response_message').innerHTML = "Network response not okay";
      return null;
    }
    const data = await response.json();
    console.log('Data received:', data);

    saveToIndexedDB(storeNames.chains, { id: chainid, ...data });
    return data;
  } catch (error) {
    console.error('There was a problem with the fetch operation:', error);
    return null;
  }
}





async function fetchAllAttacks(url, apikey, combinedData = { attacks: [] }, updateStatus, overallEnd, overallStart) {
  const fullUrl = url.includes('key=') ? url : `${url}${url.includes('?') ? '&' : '?'}key=${apikey}&comment=CV_Mass_Call`;

  const urlObj = new URL(fullUrl);
  const fromStr = urlObj.searchParams.get('from');
  const toStr = urlObj.searchParams.get('to');

  const from = fromStr ? Number(fromStr) : 0;
  const to = toStr ? Number(toStr) : Math.floor(Date.now() / 1000);
  const end = overallEnd ? Number(overallEnd) : to;
  const start = overallStart ? Number(overallStart) : from;

  const totalDuration = end - start;
  const fetchedDuration = to - start;
  const leftDuration = end - to;

  let progressPercent = 0;
  if (totalDuration > 0) {
    progressPercent = 100 - Math.min(100, (fetchedDuration / totalDuration) * 100);
  }

  let statusMessage = `Progress: ${progressPercent.toFixed(0)}% - ${formatHHMM(leftDuration)} fetched, ${formatHHMM(fetchedDuration)} left`;

  if (updateStatus) {
    updateStatus(statusMessage);
  }

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) {
      console.error('Network response not ok:', response.status);
      return combinedData;
    }

    const data = await response.json();

    combinedData.attacks = combinedData.attacks.concat(data.attacks);

    const prevLink = data._metadata?.links?.prev;

    if (prevLink) {
      await new Promise(res => setTimeout(res, 10000));
      return fetchAllAttacks(prevLink, apikey, combinedData, updateStatus, end, start);
    } else {
      return combinedData;
    }
  } catch (error) {
    console.error('Fetch error:', error);
    return combinedData;
  }
}





async function get_detailed_report(id) {
	let fullAttackList;
	const targetElement = document.getElementById(id);
	const target = targetElement.querySelector(`#display-detailed`);

	const cached = await loadFromIndexedDB(storeNames.details, id);
	if (cached) {
		console.log(`Loaded detailed report for chain ${id} from cache.`);
		document.getElementById(`loadingMessage-${id}`).remove();
		fullAttackList = cached.data; // ✅ only assign .data
	} else {
		const drepstart = targetElement.dataset.start;
		const drepend = targetElement.dataset.end;
		console.log(`Detailed report starts from ${TCT(drepstart)} to ${TCT(drepend)}, that's ${formatDuration(drepstart,drepend)}`);
		const kickoff = document.getElementById(`loadingMessage-${id}`);
		kickoff.innerHTML = `Generating detailed report. This can take a while.<br>From ${TCT(drepstart)} until ${TCT(drepend)}, that's ${formatDuration(drepstart,drepend)}`;
		fullAttackList = await fetchAllAttacks(
			`https://api.torn.com/v2/faction/attacks?limit=100&sort=DESC&to=${drepend}&from=${drepstart}&comment=CV_Mass_Call`,
			apikey,
			undefined,
			text => document.getElementById(`loadingMessage-${id}`).textContent = text,
			drepend,    // overallEnd
			drepstart   // overallStart — pass this too!
		);
		console.log('All data fetched:', fullAttackList);
		saveToIndexedDB(storeNames.details, { id, data: fullAttackList });
		document.getElementById(`loadingMessage-${id}`).textContent = 'Done fetching all data!';
    }
	if (!details.details) {
		details.details = {}; // Initialize details.details if it doesn't exist
	}
	if (details.details[id]) {
		// exists already
		console.log("details.details[id] already exists");
	} else {
		// create it
		details.details[id] = fullAttackList;
		console.log("details.details exists, but [id] did not. Created.");
	}
	console.log(details);

	// ✅ At this point, fullAttackList is available no matter where it came from
	// You can now render the data, call visualization functions, etc.
	console.log(fullAttackList);
	let chainentry = "";

	for (let a = fullAttackList.attacks.length - 1; a >= 0; a--) {
		const hit = fullAttackList.attacks[a];
		let prevhit = null;

		// Check if there are more than 10 hits after the current one
		if (a + 10 < fullAttackList.attacks.length) {
			prevhit = fullAttackList.attacks[a + 1];
		}

		if (!display_defends && (
			!hit.defender?.faction ||
			hit.defender.faction.id != our_faction_id
		)) {
			let c="";//color coding for outcome
			let r="";//conditional chain entry remove in losses
			switch(hit.result) {
				case "Attacked":
					c="#6eff7269";
					r=`#${hit.chain}`;
					break;
				case "Mugged":
					c="#efff6e69";
					r=`#${hit.chain}`;
					break;
				case "Hospitalized":
					c="#ff924469";
					r=`#${hit.chain}`;
					break;
				case "Lost":
					c="#38292952";
					r=`--`;
					break;
				case "Stalemate":
					c="#38292952";
					r=`--`;
					break;
				case "Timeout":
					c="#38292952";
					r=`--`;
					break;
				default:
					r=`#${hit.chain}`;
					break;
			}
			chainentry += `
				<tr style="background-color:#84a4ff">
					<td>${r}</td>
					<td>${hit.attacker?.name ? `<a href="https://www.torn.com/profiles.php?XID=${hit.attacker.id}">${hit.attacker.name}</a>` : "Someone"}</td>
					<td style="background-color:${c}">${hit.result}</td>
					<td><a href="https://www.torn.com/profiles.php?XID=${hit.defender.id}">${hit.defender.name}</a></td>
					<td>Respect gained</td>
					<td class="td_stealth">Stealth</td>
					<td class="td_war">War</td>
					<td class="td_raid">Raid</td>
					<td class="td_interrupt">Interrupted</td>
					<td class="td_effects">Effects</td>
					<td class="td_enemy_loss">Enemy respect loss</td>
					<td class="td_multi">Multipliers:</td>
					<td class="td_multi"><i>Fair fight</i></td>
					<td class="td_multi"><i>Chain</i></td>
					<td class="td_multi"><i>Group</i></td>
					<td class="td_multi"><i>Overseas</i></td>
					<td class="td_multi"><i>Retal</i></td>
					<td class="td_multi"><i>War</i></td>
					<td class="td_multi"><i>Warlord</i></td>
					<td>Chain timer</td>
					<td rowspan="2"><a href="https://www.torn.com/loader.php?sid=attackLog&ID=${hit.code}">Link</a></td>
				</tr>
				<tr style="background-color:#84a4ff">
					<td>${TCT(hit.ended)}</td>
					<td>${hit.attacker?.faction?.name ?? "-"}</td>
					<td> vs </td>
					<td>${hit.defender?.faction?.name ?? "-"}</td>
					<td>${hit.respect_gain}</td>
					<td class="td_stealth">${hit.is_stealthed}</td>
					<td class="td_war">${hit.is_ranked_war}</td>
					<td class="td_raid">${hit.is_raid}</td>
					<td class="td_interrupt">${hit.is_interrupted}</td>
					<td class="td_effects">${Array.isArray(hit.finishing_hit_effects) && hit.finishing_hit_effects.length > 0
						? hit.finishing_hit_effects.map(effect => `${effect.name}(${effect.value})`).join(", ")
						: "None"}</td>
					<td class="td_enemy_loss">${hit.respect_loss}</td>
					<td class="td_multi">Total: ${(hit.modifiers.fair_fight * hit.modifiers.chain * hit.modifiers.group * hit.modifiers.overseas * hit.modifiers.retaliation * hit.modifiers.war * hit.modifiers.warlord).toFixed(3)}</td>
					<td class="td_multi">${hit.modifiers.fair_fight}</td>
					<td class="td_multi">${hit.modifiers.chain}</td>
					<td class="td_multi">${hit.modifiers.group}</td>
					<td class="td_multi">${hit.modifiers.overseas}</td>
					<td class="td_multi">${hit.modifiers.retaliation}</td>
					<td class="td_multi">${hit.modifiers.war}</td>
					<td class="td_multi">${hit.modifiers.warlord}</td>
					<td>${prevhit ? formatMMSS(Math.max(0, 300 - (hit.ended - prevhit.ended))) : "N/A"}</td>

				</tr>
				<tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
			`;
		} else {
			//continue;
			{
			let c="";//color coding for outcome
			let r="";//conditional chain entry remove in losses
			switch(hit.result) {
				case "Lost":
					c="#6eff7269";
					r="--";
					break;
				case "Stalemate":
					c="#6eff7269";
					break;
				case "Timeout":
					c="#6eff7269";
					break;
				default:
					r=`#${hit.chain}`;
					break;
			}
			chainentry += `
				<tr style="background-color:#c54545">
					<td>${r}</td>
					<td>${hit.attacker?.name ? `<a href="https://www.torn.com/profiles.php?XID=${hit.attacker.id}">${hit.attacker.name}</a>` : "Someone"}</td>
					<td style="background-color:${c}">${hit.result}</td>
					<td><a href="https://www.torn.com/profiles.php?XID=${hit.defender.id}">${hit.defender.name}</a></td>
					<td>Respect lost</td>
					<td class="td_stealth">Stealth</td>
					<td class="td_war">War</td>
					<td class="td_raid">Raid</td>
					<td class="td_interrupt">Interrupted</td>
					<td class="td_effects">Effects</td>
					<td class="td_enemy_loss">Enemy respect gain</td>
					<td class="td_multi">Multipliers:</td>
					<td class="td_multi"><i>Fair fight</i></td>
					<td class="td_multi"><i>Chain</i></td>
					<td class="td_multi"><i>Group</i></td>
					<td class="td_multi"><i>Overseas</i></td>
					<td class="td_multi"><i>Retal</i></td>
					<td class="td_multi"><i>War</i></td>
					<td class="td_multi"><i>Warlord</i></td>
					<td>Chain timer</td>
					<td rowspan="2"><a href="https://www.torn.com/loader.php?sid=attackLog&ID=${hit.code}">Link</a></td>
				</tr>
				<tr style="background-color:#c54545">
					<td>${TCT(hit.ended)}</td>
					<td>${hit.attacker?.faction?.name ?? "-"}</td>
					<td> vs </td>
					<td>${hit.defender?.faction?.name ?? "-"}</td>
					<td>${hit.respect_loss}</td>
					<td class="td_stealth">${hit.is_stealthed}</td>
					<td class="td_war">${hit.is_ranked_war}</td>
					<td class="td_raid">${hit.is_raid}</td>
					<td class="td_interrupt">${hit.is_interrupted}</td>
					<td class="td_effects">${Array.isArray(hit.finishing_hit_effects) && hit.finishing_hit_effects.length > 0
						? hit.finishing_hit_effects.map(effect => `${effect.name}(${effect.value})`).join(", ")
						: "None"}</td>
					<td class="td_enemy_loss">${hit.respect_gain}</td>
					<td class="td_multi">Total: ${(hit.modifiers.fair_fight * hit.modifiers.chain * hit.modifiers.group * hit.modifiers.overseas * hit.modifiers.retaliation * hit.modifiers.war * hit.modifiers.warlord).toFixed(3)}</td>
					<td class="td_multi">${hit.modifiers.fair_fight}</td>
					<td class="td_multi">${hit.modifiers.chain}</td>
					<td class="td_multi">${hit.modifiers.group}</td>
					<td class="td_multi">${hit.modifiers.overseas}</td>
					<td class="td_multi">${hit.modifiers.retaliation}</td>
					<td class="td_multi">${hit.modifiers.war}</td>
					<td class="td_multi">${hit.modifiers.warlord}</td>
					<td>${prevhit ? formatMMSS(Math.max(0, 300 - (hit.ended - prevhit.ended))) : "N/A"}</td>

				</tr>
				<tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
			`;
			}	}
	}


	if (chainentry !== "") {
		const entry = document.createElement('div');
		entry.classList = "detailed_entry";
		entry.innerHTML = `
			<table style="text-align:center">
			${chainentry}
			</table>
		`;
		target.append(entry);
	}


}

async function create_custom_detailed_report(start,end) {
	let fullAttackList;
	const targetElement = document.getElementById("custom");
	const target = targetElement.querySelector(`#display-detailed`);

	if (true) {
		const drepstart = start;
		const drepend = end;
		console.log(`Detailed report starts from ${TCT(drepstart)} to ${TCT(drepend)}, that's ${formatDuration(drepstart,drepend)}`);
		const kickoff = document.getElementById(`loadingMessage-custom`);
		kickoff.innerHTML = `Generating detailed report. This can take a while.<br>From ${TCT(drepstart)} until ${TCT(drepend)}, that's ${formatDuration(drepstart,drepend)}`;
		fullAttackList = await fetchAllAttacks(
			`https://api.torn.com/v2/faction/attacks?limit=100&sort=DESC&to=${drepend}&from=${drepstart}&comment=CV_Mass_Call`,
			apikey,
			undefined,
			text => document.getElementById(`loadingMessage-custom`).textContent = text,
			drepend,    // overallEnd
			drepstart   // overallStart — pass this too!
		);
		console.log('All data fetched:', fullAttackList);
		document.getElementById(`loadingMessage-custom`).textContent = 'Done fetching all data!';
    }
	let chainentry = "";

	for (let a = fullAttackList.attacks.length - 1; a >= 0; a--) {
		const hit = fullAttackList.attacks[a];
		let prevhit = null;

		// Check if there are more than 10 hits after the current one
		if (a + 10 < fullAttackList.attacks.length) {
			prevhit = fullAttackList.attacks[a + 1];
		}

		if (!display_defends && (
			!hit.defender?.faction ||
			hit.defender.faction.id != our_faction_id
		)) {
			let c="";//color coding for outcome
			let r="";//conditional chain entry remove in losses
			switch(hit.result) {
				case "Attacked":
					c="#6eff7269";
					r=`#${hit.chain}`;
					break;
				case "Mugged":
					c="#efff6e69";
					r=`#${hit.chain}`;
					break;
				case "Hospitalized":
					c="#ff924469";
					r=`#${hit.chain}`;
					break;
				case "Lost":
					c="#38292952";
					r=`--`;
					break;
				case "Stalemate":
					c="#38292952";
					r=`--`;
					break;
				case "Timeout":
					c="#38292952";
					r=`--`;
					break;
				default:
					r=`#${hit.chain}`;
					break;
			}
			chainentry += `
				<tr style="background-color:#84a4ff">
					<td>${r}</td>
					<td>${hit.attacker?.name ? `<a href="https://www.torn.com/profiles.php?XID=${hit.attacker.id}">${hit.attacker.name}</a>` : "Someone"}</td>
					<td style="background-color:${c}">${hit.result}</td>
					<td><a href="https://www.torn.com/profiles.php?XID=${hit.defender.id}">${hit.defender.name}</a></td>
					<td>Respect gained</td>
					<td class="td_stealth">Stealth</td>
					<td class="td_war">War</td>
					<td class="td_raid">Raid</td>
					<td class="td_interrupt">Interrupted</td>
					<td class="td_effects">Effects</td>
					<td class="td_enemy_loss">Enemy respect loss</td>
					<td class="td_multi">Multipliers:</td>
					<td class="td_multi"><i>Fair fight</i></td>
					<td class="td_multi"><i>Chain</i></td>
					<td class="td_multi"><i>Group</i></td>
					<td class="td_multi"><i>Overseas</i></td>
					<td class="td_multi"><i>Retal</i></td>
					<td class="td_multi"><i>War</i></td>
					<td class="td_multi"><i>Warlord</i></td>
					<td>Chain timer</td>
					<td rowspan="2"><a href="https://www.torn.com/loader.php?sid=attackLog&ID=${hit.code}">Link</a></td>
				</tr>
				<tr style="background-color:#84a4ff">
					<td>${TCT(hit.ended)}</td>
					<td>${hit.attacker?.faction?.name ?? "-"}</td>
					<td> vs </td>
					<td>${hit.defender?.faction?.name ?? "-"}</td>
					<td>${hit.respect_gain}</td>
					<td class="td_stealth">${hit.is_stealthed}</td>
					<td class="td_war">${hit.is_ranked_war}</td>
					<td class="td_raid">${hit.is_raid}</td>
					<td class="td_interrupt">${hit.is_interrupted}</td>
					<td class="td_effects">${Array.isArray(hit.finishing_hit_effects) && hit.finishing_hit_effects.length > 0
						? hit.finishing_hit_effects.map(effect => `${effect.name}(${effect.value})`).join(", ")
						: "None"}</td>
					<td class="td_enemy_loss">${hit.respect_loss}</td>
					<td class="td_multi">Total: ${(hit.modifiers.fair_fight * hit.modifiers.chain * hit.modifiers.group * hit.modifiers.overseas * hit.modifiers.retaliation * hit.modifiers.war * hit.modifiers.warlord).toFixed(3)}</td>
					<td class="td_multi">${hit.modifiers.fair_fight}</td>
					<td class="td_multi">${hit.modifiers.chain}</td>
					<td class="td_multi">${hit.modifiers.group}</td>
					<td class="td_multi">${hit.modifiers.overseas}</td>
					<td class="td_multi">${hit.modifiers.retaliation}</td>
					<td class="td_multi">${hit.modifiers.war}</td>
					<td class="td_multi">${hit.modifiers.warlord}</td>
					<td>${prevhit ? formatMMSS(Math.max(0, 300 - (hit.ended - prevhit.ended))) : "N/A"}</td>

				</tr>
				<tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
			`;
		} else {
			//continue;
			{
			let c="";//color coding for outcome
			let r="";//conditional chain entry remove in losses
			switch(hit.result) {
				case "Lost":
					c="#6eff7269";
					r="--";
					break;
				case "Stalemate":
					c="#6eff7269";
					break;
				case "Timeout":
					c="#6eff7269";
					break;
				default:
					r=`#${hit.chain}`;
					break;
			}
			chainentry += `
				<tr style="background-color:#c54545">
					<td>${r}</td>
					<td>${hit.attacker?.name ? `<a href="https://www.torn.com/profiles.php?XID=${hit.attacker.id}">${hit.attacker.name}</a>` : "Someone"}</td>
					<td style="background-color:${c}">${hit.result}</td>
					<td><a href="https://www.torn.com/profiles.php?XID=${hit.defender.id}">${hit.defender.name}</a></td>
					<td>Respect lost</td>
					<td class="td_stealth">Stealth</td>
					<td class="td_war">War</td>
					<td class="td_raid">Raid</td>
					<td class="td_interrupt">Interrupted</td>
					<td class="td_effects">Effects</td>
					<td class="td_enemy_loss">Enemy respect gain</td>
					<td class="td_multi">Multipliers:</td>
					<td class="td_multi"><i>Fair fight</i></td>
					<td class="td_multi"><i>Chain</i></td>
					<td class="td_multi"><i>Group</i></td>
					<td class="td_multi"><i>Overseas</i></td>
					<td class="td_multi"><i>Retal</i></td>
					<td class="td_multi"><i>War</i></td>
					<td class="td_multi"><i>Warlord</i></td>
					<td>Chain timer</td>
					<td rowspan="2"><a href="https://www.torn.com/loader.php?sid=attackLog&ID=${hit.code}">Link</a></td>
				</tr>
				<tr style="background-color:#c54545">
					<td>${TCT(hit.ended)}</td>
					<td>${hit.attacker?.faction?.name ?? "-"}</td>
					<td> vs </td>
					<td>${hit.defender?.faction?.name ?? "-"}</td>
					<td>${hit.respect_loss}</td>
					<td class="td_stealth">${hit.is_stealthed}</td>
					<td class="td_war">${hit.is_ranked_war}</td>
					<td class="td_raid">${hit.is_raid}</td>
					<td class="td_interrupt">${hit.is_interrupted}</td>
					<td class="td_effects">${Array.isArray(hit.finishing_hit_effects) && hit.finishing_hit_effects.length > 0
						? hit.finishing_hit_effects.map(effect => `${effect.name}(${effect.value})`).join(", ")
						: "None"}</td>
					<td class="td_enemy_loss">${hit.respect_gain}</td>
					<td class="td_multi">Total: ${(hit.modifiers.fair_fight * hit.modifiers.chain * hit.modifiers.group * hit.modifiers.overseas * hit.modifiers.retaliation * hit.modifiers.war * hit.modifiers.warlord).toFixed(3)}</td>
					<td class="td_multi">${hit.modifiers.fair_fight}</td>
					<td class="td_multi">${hit.modifiers.chain}</td>
					<td class="td_multi">${hit.modifiers.group}</td>
					<td class="td_multi">${hit.modifiers.overseas}</td>
					<td class="td_multi">${hit.modifiers.retaliation}</td>
					<td class="td_multi">${hit.modifiers.war}</td>
					<td class="td_multi">${hit.modifiers.warlord}</td>
					<td>${prevhit ? formatMMSS(Math.max(0, 300 - (hit.ended - prevhit.ended))) : "N/A"}</td>

				</tr>
				<tr></tr><tr></tr><tr></tr><tr></tr><tr></tr><tr></tr>
			`;
			}
		}
	}


	if (chainentry !== "") {
		const entry = document.createElement('div');
		entry.classList = "detailed_entry";
		entry.innerHTML = `
			<table style="text-align:center">
			${chainentry}
			</table>
		`;
		target.append(entry);
	}
	fill_custom_chain_data(start,end,fullAttackList);

}

async function bypass_chain_list() {
	document.querySelector('#body').innerHTML = `
		<form id="time-form">
			<h3>Start</h3>
			<input type="date" id="start-date" required>
			<input type="time" id="start-time" required>

			<h3>End</h3>
			<input type="date" id="end-date" required>
			<input type="time" id="end-time" required>

			<button type="submit">Submit</button>
		</form>
	`;

	// Current UTC date and time
	const now = new Date();
	const nowDate = now.toISOString().split("T")[0];       // YYYY-MM-DD
	const nowTime = now.toISOString().split("T")[1].slice(0, 5); // HH:MM

	// Set max for date inputs (to prevent selecting future days)
	document.getElementById("start-date").max = nowDate;
	document.getElementById("end-date").max = nowDate;

	// Function to dynamically limit time inputs only if date is today
	function updateMaxTimeLimits() {
		const startDate = document.getElementById("start-date").value;
		const endDate = document.getElementById("end-date").value;

		if (startDate === nowDate) {
			document.getElementById("start-time").max = nowTime;
		} else {
			document.getElementById("start-time").removeAttribute("max");
		}

		if (endDate === nowDate) {
			document.getElementById("end-time").max = nowTime;
		} else {
			document.getElementById("end-time").removeAttribute("max");
		}
	}

	// Attach listeners to date inputs
	document.getElementById("start-date").addEventListener("input", updateMaxTimeLimits);
	document.getElementById("end-date").addEventListener("input", updateMaxTimeLimits);
	updateMaxTimeLimits(); // Initial run in case today's date is prefilled

	// Utility function to construct UTC time from date + time
	function getLondonUTCDate(dateStr, timeStr) {
		if (!dateStr || !timeStr) return null;

		const [year, month, day] = dateStr.split("-").map(Number);
		const [hour, minute] = timeStr.split(":").map(Number);

		return new Date(Date.UTC(year, month - 1, day, hour, minute));
	}

	// Form submission handler
	document.querySelector('#time-form').addEventListener('submit', function (e) {
		e.preventDefault();

		const startDate = document.getElementById("start-date").value;
		const startTime = document.getElementById("start-time").value;
		const endDate = document.getElementById("end-date").value;
		const endTime = document.getElementById("end-time").value;

		const startUTC = getLondonUTCDate(startDate, startTime);
		const endUTC = getLondonUTCDate(endDate, endTime);

		const start = startUTC.getTime() / 1000; // seconds
		const end = endUTC.getTime() / 1000;     // seconds

		const nowEpoch = Date.now() / 1000;

		if (start > nowEpoch || end > nowEpoch) {
			alert("Please select a time in the past.");
			return;
		}
		if (end <= start) {
			alert("End time must be after start time.");
			return;
		}

		console.log("Start UNIX epoch (sec):", start);
		console.log("End UNIX epoch (sec):", end);

		create_custom_report(start, end);
	});

	// Disable other UI while form is active
	document.querySelector('#submit_selected').disabled = true;
}

function buildCustomStats(data) {
	if (!Array.isArray(data)) {
		console.error("Invalid data passed to buildCustomStats: expected an array, got:", data);
		return null;
	}
	const BONUS_CHAINS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
	const CUSTOM = {
		respectRounded: 0,
		lengthRounded: 0,
		assists: 0,
		best: 0,
		draws: 0,
		escapes: 0,
		hospitalize: 0,
		leave: 0,
		losses: 0,
		mug: 0,
		overseas: 0,
		retaliations: 0,
		war: 0,
		members: [],
		targets: 0,
		bonuses: {}
	};

	const memberSet = new Set();
	const targetSet = new Set();

	for (const entry of data) {
	const attacker = entry.attacker ?? null;
	const defender = entry.defender ?? null;

	// Safe check for factions
	const attackerFaction = attacker?.faction?.name;
	const defenderFaction = defender?.faction?.name;

	const isBabyChampers = attackerFaction === "Baby Champers";

	if (isBabyChampers) {
		// ✅ Count Baby Champers stats only if attacker is known and in faction

		switch (entry.result) {
		case "Assist": CUSTOM.assists++; break;
		case "Draw": CUSTOM.draws++; break;
		case "Escape": CUSTOM.escapes++; break;
		case "Hospitalized":
			CUSTOM.hospitalize++;
			CUSTOM.lengthRounded++; // ✅ Count for lengthRounded
		break;
		case "Attacked":
			CUSTOM.leave++;
			CUSTOM.lengthRounded++; // ✅ Count for lengthRounded
		break;
		case "Lost": CUSTOM.losses++; break;
		case "Mugged":
			CUSTOM.mug++;
			CUSTOM.lengthRounded++; // ✅ Count for lengthRounded
		break;
		}


		const respect = entry.respect_gain ?? 0;
		CUSTOM.respectRounded += respect;
		if (respect > CUSTOM.best) CUSTOM.best = respect;

		if (entry.modifiers?.overseas > 1) CUSTOM.overseas++;
		if (entry.modifiers?.retaliation > 1) CUSTOM.retaliations++;
		if (entry.is_ranked_war) CUSTOM.war++;

		// Unique Baby Champers member
		if (attacker?.id != null) memberSet.add(attacker.id);

		// Chain milestone
		if (BONUS_CHAINS.includes(entry.chain)) {
			const chainKey = String(entry.chain);
			if (!CUSTOM.bonuses[chainKey]) CUSTOM.bonuses[chainKey] = [];
			CUSTOM.bonuses[chainKey].push(attacker.name ?? "Unknown");
		}
	}

	// ✅ Count unique defenders not in Baby Champers
	if (!defenderFaction || defenderFaction !== "Baby Champers") {
		if (defender?.id != null) targetSet.add(defender.id);
	}
}

	// Finalize members and targets
	CUSTOM.members = Array.from(memberSet);
	CUSTOM.targets = targetSet.size;

	return CUSTOM;
}


async function fill_custom_chain_data(start,end,FAD) {
	console.log("Full attack data available to fill_custom_chain_data:");
	console.log(FAD);
	const CUSTOM = buildCustomStats(FAD.attacks);
	console.log("CUSTOM:");
	console.log(CUSTOM);
	const header = `
	<table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	  <thead>
        <tr>
          <th>Chain ID</th>
          <th>Start Time</th>
          <th>End Time</th>
		  <th>Duration</th>
          <th>Respect</th>
          <th>Length</th>
        </tr>
      </thead>
      <tbody>
	    <td>CUSTOM</td>
        <td>${TCT(start)}</td>
        <td>${TCT(end)}</td>
		<td>${formatDuration(start,end)}</td>
        <td>${CUSTOM.respectRounded}</td>
        <td>${CUSTOM.lengthRounded}</td>
	  </tbody>
    </table>
	<table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	<tbody>
	    <td>Assists: ${CUSTOM.assists}</td>
        <td>Best hit: ${CUSTOM.best}</td>
        <td>Draws: ${CUSTOM.draws}</td>
        <td>Escapes: ${CUSTOM.escapes}</td>
        <td>Hosps: ${CUSTOM.hospitalize}</td>
		<td>Leave: ${CUSTOM.leave}</td>
		<td>Losses: ${CUSTOM.losses}</td>
		<td>Mugs: ${CUSTOM.mug}</td>
		<td>Overseas: ${CUSTOM.overseas}</td>
		<td>Retals: ${CUSTOM.retaliations}</td>
		<td>War hits: ${CUSTOM.war}</td>
		<td>Participants: ${CUSTOM.members.length}</td>
		<td>Total targets: ${CUSTOM.targets}</td>
	  </tbody>
    </table>
	<table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	  <tbody>
	    ${CUSTOM.bonuses}
	  </tbody>
    </table>
	`;
	var el = document.getElementById("custom");
	el.innerHTML = header + el.innerHTML;

}

async function create_custom_report(start,end) {
  document.querySelector('#body').innerHTML = ``;
  document.querySelector('#submit_selected').disabled = true;
	document.querySelector('#submit_selected').innerHTML = "Loading...";
	let detailed_message;
		//selectedCIDs[i] does NOT exist in db details
		detailed_message = `<span id="loadingMessage-custom">
	    <button onclick="create_custom_detailed_report(${start},${end})">Generate detailed report</button>
	    This can take a VERY long time. 10 seconds for each 100 events.
	  </span>`
	
	
	const newChainBlock = document.createElement('div');
	
	newChainBlock.id = "custom";
	newChainBlock.dataset.start = start;
	newChainBlock.dataset.end = end;
	newChainBlock.style.width = "85%";
	newChainBlock.style.border = "3px solid black";
	newChainBlock.innerHTML = `
	<div width="100%">
	<button onclick=toggle(custom,"display-torn")>Torn style</button>
	<button onclick=toggle(custom,"display-detailed")>Detailed</button>
	<button onclick=toggle(custom,"display-timeline")>Timeline</button>
	</div>
	<div id="display-torn" style="display:none";>
	  <table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	    <thead>
        <tr>
          <th>Name</th>
          <th>Attacks</th>
          <th>Leave</th>
          <th>Mug</th>
          <th>Hosp</th>
		  <th>Lost</th>
		  <th>Escape</th>
		  <th>Draws</th>
		  <th>Assists</th>
		  <th>Overseas</th>
		  <th>Retal</th>
		  <th>War</th>
		  <th>Bonuses</th>
        </tr>
      </thead>
		<tbody>
	      WIP
	    </tbody>
      </table>
	</div>
	
	<div id="display-detailed";>
	  ${detailed_message}
	</div>
	
	<div id="display-timeline" style="display:none";>
		WIP
	</div>

	<br>`;
	document.querySelector('#body').appendChild(newChainBlock);
	document.querySelector('#submit_selected').style.display = "none";
}

async function generate_chain_list(response) {
  const chains = response.chains;

  // Add or replace the submit button
  document.querySelector('#header').innerHTML = `
    <button id="submit_selected" onclick="select_chains()" style="500px" disabled>Submit</button>
    <span id="api_response_message"></span>
  `;

  const listElement = document.getElementById('chain_list');

  listElement.innerHTML = `
    <button onclick='bypass_chain_list();'>Or fetch a custom attack duration</button><br>
    <table border="1" style="border-collapse: collapse; width: 500px; background-color: white; text-align:right">
      <thead>
        <tr>
          <th></th>
          <th>Start Time</th>
          <th>End Time</th>
          <th>Duration</th>
          <th>Respect</th>
          <th>Length</th>
        </tr>
      </thead>
      <tbody id="chain_table_body"></tbody>
    </table>
  `;

  const tableBody = document.getElementById('chain_table_body');

  function updateSubmitButtonState() {
    const checkboxes = document.querySelectorAll('.row-checkbox');
    const checkedCount = [...checkboxes].filter(cb => cb.checked).length;
    const submitButton = document.getElementById('submit_selected');

    submitButton.disabled = checkedCount === 0 || checkedCount > 10;
  }

  // Iterate over chains to populate the table
  for (const chain of chains) {
    const keyToCheck = (chain.id).toString();  // Ensure key is a string
    const exists = await checkKeyExists(storeNames.chains, keyToCheck);  // Check if the key exists in IndexedDB
	if ( exists ) {
		console.log(`found ${keyToCheck} in db chains`);
	} else {
		console.log(`could not find ${keyToCheck} in db chains`);
	}

    const respectRounded = Math.floor(chain.respect);
    const lengthRounded = Math.floor(chain.chain);

    // Create table row
    const row = document.createElement('tr');
    row.innerHTML = `
      <td><input type="checkbox" class="row-checkbox" CID="${chain.id}"/></td>
      <td>${TCT(chain.start)}</td>
      <td>${TCT(chain.end)}</td>
      <td>${formatDuration(chain.start, chain.end)}</td>
      <td>${Math.floor(chain.respect)}</td>
      <td>${Math.floor(chain.chain)}</td>
    `;

    // Color the row if the chain has been processed (exists in the DB)
    if (exists) row.style.backgroundColor = 'lightblue';

    const checkbox = row.querySelector('.row-checkbox');
    checkbox.addEventListener('change', () => {
      if (!exists) {
        row.style.backgroundColor = checkbox.checked ? '#d0f0c0' : '';  // Change row color when selected
      }
      updateSubmitButtonState();
    });

    tableBody.appendChild(row);
  }
}

async function select_chains() {
  const checkedBoxes = document.querySelectorAll('.row-checkbox:checked');
  const selectedCIDs = Array.from(checkedBoxes).map(cb => cb.getAttribute('CID'));
  
  

  console.log('Selected CIDs:', selectedCIDs);
  document.querySelector('#body').innerHTML = ``;
  document.querySelector('#submit_selected').disabled = true;
  for(var i=0;i<selectedCIDs.length;i++) {
	document.querySelector('#submit_selected').innerHTML = "Loading " + (i+1) + " of " + selectedCIDs.length;
	const chaindataAPI = await try_fetch_API_chain(selectedCIDs[i]);
	const chaindata = chaindataAPI.chainreport;
	const keyToCheck = Number(selectedCIDs[i]); // Make sure this is the correct type (string or number)
	const exists = await checkKeyExists(storeNames.details, keyToCheck);
	let detailed_message;
	if (exists) {
		//selectedCIDs[i] exists in db details
		detailed_message = `<span id="loadingMessage-${selectedCIDs[i]}">
	    <button onclick="get_detailed_report(${selectedCIDs[i]})">Load detailed report from memory</button>
	  </span>`
	} else {
		//selectedCIDs[i] does NOT exist in db details
		detailed_message = `<span id="loadingMessage-${selectedCIDs[i]}">
	    <button onclick="get_detailed_report(${selectedCIDs[i]})">Generate detailed report</button>
	    This can take a long time. 10 seconds for each 100 events under chain period.
	  </span>`
	}


	
	const newChainBlock = document.createElement('div');
	const respectRounded = Math.floor(chaindata.details.respect);
    const lengthRounded = Math.floor(chaindata.details.chain);
	let bonuses = '';
	for (o=0;o<chaindata.bonuses.length;o++) {
		bonuses+=`<td>${toName(chaindata.bonuses[o].attacker_id)}<br> got hit ${chaindata.bonuses[o].chain} on <br> ${chaindata.bonuses[o].defender_id}</td>`
	}
	let tornstylehits = '';
	for (p=0;p<chaindata.attackers.length;p++) {
		tornstylehits+=`<tr>`
		tornstylehits+=`<td>${toName(chaindata.attackers[p].id)}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.total}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.leave}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.mug}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.hospitalize}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.losses}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.escapes}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.draws}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.assists}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.overseas}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.retaliations}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.war}</td>`
		tornstylehits+=`<td>${chaindata.attackers[p].attacks.bonuses}</td>`
		tornstylehits+=`</tr>`
	}
	const nonhitters = chaindata.non_attackers
	  .map(id => toName(id))
	  .join(', ');
	newChainBlock.id = selectedCIDs[i];
	newChainBlock.dataset.start = chaindata.start;
	newChainBlock.dataset.end = chaindata.end;
	const cachedDetail = await loadFromIndexedDB(storeNames.details, selectedCIDs[i]);
    const detailButtonText = cachedDetail
    ? '<span style="color:green">Already cached</span>'
    : '<button onclick="get_detailed_report(' + selectedCIDs[i] + ')">Generate detailed report</button>';

	newChainBlock.style.width = "85%";
	newChainBlock.style.border = "3px solid black";
	await loadDataForCID(selectedCIDs[i]);
	newChainBlock.innerHTML = `
	<table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	  <thead>
        <tr>
          <th>Chain ID</th>
          <th>Start Time</th>
          <th>End Time</th>
		  <th>Duration</th>
          <th>Respect</th>
          <th>Length</th>
        </tr>
      </thead>
      <tbody>
	    <td>${chaindata.id}</td>
        <td>${TCT(chaindata.start)}</td>
        <td>${TCT(chaindata.end)}</td>
		<td>${formatDuration(chaindata.start,chaindata.end)}</td>
        <td>${respectRounded}</td>
        <td>${lengthRounded}</td>
	  </tbody>
    </table>
	<table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	<tbody>
	    <td>Assists: ${chaindata.details.assists}</td>
        <td>Best hit: ${chaindata.details.best}</td>
        <td>Draws: ${chaindata.details.draws}</td>
        <td>Escapes: ${chaindata.details.escapes}</td>
        <td>Hosps: ${chaindata.details.hospitalize}</td>
		<td>Leave: ${chaindata.details.leave}</td>
		<td>Losses: ${chaindata.details.losses}</td>
		<td>Mugs: ${chaindata.details.mug}</td>
		<td>Overseas: ${chaindata.details.overseas}</td>
		<td>Retals: ${chaindata.details.retaliations}</td>
		<td>War hits: ${chaindata.details.war}</td>
		<td>Participants: ${chaindata.details.members}</td>
		<td>Total targets: ${chaindata.details.targets}</td>
	  </tbody>
    </table>
	<table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	  <tbody>
	    ${bonuses}
	  </tbody>
    </table>
	<div width="100%">
	<button onclick=toggle(${selectedCIDs[i]},"display-torn")>Torn style</button>
	<button onclick=toggle(${selectedCIDs[i]},"display-detailed")>Detailed</button>
	<button onclick=toggle(${selectedCIDs[i]},"display-timeline")>Timeline</button>
	</div>
	<div id="display-torn" style="display:none";>
	  <table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	    <thead>
        <tr>
          <th>Name</th>
          <th>Attacks</th>
          <th>Leave</th>
          <th>Mug</th>
          <th>Hosp</th>
		  <th>Lost</th>
		  <th>Escape</th>
		  <th>Draws</th>
		  <th>Assists</th>
		  <th>Overseas</th>
		  <th>Retal</th>
		  <th>War</th>
		  <th>Bonuses</th>
        </tr>
      </thead>
		<tbody>
	      ${tornstylehits}
	    </tbody>
      </table>
	</div>
	
	<div id="display-detailed" style="display:none";>
	  ${detailed_message}


	</div>
	
	<div id="display-timeline" style="display:none";>
	<button onclick="generate_timeline(${selectedCIDs[i]})">Generate Timeline</button>
	</div>
	<table border="2" style="border-collapse: collapse; text-align:center;width:100%;">
	    <thead>
        <tr>
          <th>Non-hitters</th>
        </tr>
      </thead>
		<tbody>
	      <td>${nonhitters}</td>
	    </tbody>
      </table>
	<br>`;
	document.querySelector('#body').appendChild(newChainBlock);
	console.log("Chaindata:");
	console.log(chaindata);
  }
  document.querySelector('#submit_selected').style.display = "none";
  

}

// Highlight events for a specific member
function highlightMemberEvents(cid, memberName) {
    const events = document.querySelectorAll(`#timeline-${cid} .event-circle`);
    events.forEach(event => {
        // Compare the value of the data-name attribute to the selected member's name
		
        if (event.getAttribute('data-name') === memberName) {
            event.style.transform = 'scale(1.1)'; // Enlarge the event circle
            event.style.zIndex = '10'; // Optional: Bring to front if needed
			event.style.backgroundColor="teal";
			event.style.border="2px solid gold";
			
        } else {
            event.style.transform = 'scale(1)'; // Reset other events
            event.style.zIndex = '0'; // Reset zIndex
        }
    });
}


async function generate_timeline(cid) {
	//await loadDataForCID(cid);
	console.log(details);
  // Check if the data for this CID is already in `details`
  if (!details['details'] || !details['details'][cid]) {
    console.log("Detailed report not available. Please generate it first.");
    return;
  }

  // Use the data directly from `details` (no need to load from IndexedDB again)
  const chaindata = details['details'][cid];

  // Check if chaindata exists for the given CID
  if (!chaindata) {
    alert("Generate detailed report first");
    return;
  }

  // Get the target element where the timeline will be appended
  const targetElement = document.getElementById(cid);
  
  // Create Timeline Container
  const timelineContainer = document.createElement('div');
  timelineContainer.id = `timeline-${cid}`;
  targetElement.appendChild(timelineContainer);

  // Toggle for Timeline View (Left to Right or Up to Down)
  const toggleBtn = document.createElement('button');
  toggleBtn.innerHTML = "Toggle Timeline View";
  toggleBtn.onclick = () => toggleTimelineView(cid); // Pass CID to toggle
  targetElement.appendChild(toggleBtn);

  // Render the timeline (this is the horizontal timeline by default)
  renderTimeline(cid, chaindata, timelineContainer);
}

async function renderTimeline(cid, chaindata, timelineContainer) {
    const chain_start = details.chains[cid].chainreport.start;
    const chain_end = details.chains[cid].chainreport.end;

    // Create the timeline bar with visible styling
    const timelineBar = document.createElement('div');
    timelineBar.style.position = 'relative';
    timelineBar.style.width = '100%';
    timelineBar.style.height = '50px'; // Height of the timeline bar
    timelineBar.style.background = '#f0f0f0';
    timelineBar.style.border = '1px solid #ccc'; // Border to make the timeline visible
    timelineContainer.appendChild(timelineBar);

    // Fetch attacks from the details object
    const attacks = details.details[cid].attacks;

    // Loop through attacks and add events to the timeline
    attacks.forEach(attack => {
        const eventTime = attack.ended; // The timestamp of the event

        // Calculate the position of the event as a percentage within the chain period
        const eventPosition = ((eventTime - chain_start) / (chain_end - chain_start)) * 100;

        // Create the event circle
        const eventCircle = document.createElement('div');
        eventCircle.style.position = 'absolute';
        eventCircle.style.left = `${eventPosition}%`; // Set the left position based on calculated percentage
        eventCircle.style.top = '50%'; // Vertically center the event circle
        eventCircle.style.transform = 'translateY(-50%)'; // Adjust positioning to align correctly
        eventCircle.style.width = '10px';
        eventCircle.style.height = '10px';
        eventCircle.style.borderRadius = '50%';
        eventCircle.style.backgroundColor = 'gray'; // Default color
		eventCircle.classList.add('event-circle');

        // Check if the attacker or defender belongs to the same faction, with fallbacks
        if (attack.attacker && attack.attacker.faction && attack.attacker.faction.id === our_faction_id) {
            eventCircle.style.backgroundColor = 'green'; // Green for attacker
        } else if (attack.defender && attack.defender.faction && attack.defender.faction.id === our_faction_id) {
            eventCircle.style.backgroundColor = 'red'; // Red for defender
        } else if (!attack.attacker.faction) {
            // If no attacker.faction exists, consider it a defend (red)
            eventCircle.style.backgroundColor = 'red';
        } else if (!attack.defender.faction) {
            // If no defender.faction exists, consider it an attack (green)
            eventCircle.style.backgroundColor = 'green';
        }

        // Create tooltip (expandable on hover)
        const tooltip = document.createElement('div');
        // Check if the attacker faction exists and matches our faction ID
        if (attack.attacker && attack.attacker.faction && attack.attacker.faction.id === our_faction_id) {
            tooltip.innerHTML = attack.attacker.name; // It's an attack, show attacker.name
            eventCircle.setAttribute('data-name', attack.attacker.name); // Store the name for matching
        } else {
            tooltip.innerHTML = attack.defender.name; // It's a defend (attacker.faction doesn't exist or doesn't match), show defender.name
            eventCircle.setAttribute('data-name', attack.defender.name); // Store the name for matching
        }

        tooltip.style.position = 'absolute';
        tooltip.style.bottom = '20px';
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.visibility = 'hidden';
        tooltip.style.background = '#333';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '5px';
        tooltip.style.borderRadius = '5px';
        eventCircle.appendChild(tooltip);

        // Show tooltip on hover
        eventCircle.onmouseover = function() {
            tooltip.style.visibility = 'visible';
        };
        eventCircle.onmouseout = function() {
            tooltip.style.visibility = 'hidden';
        };

        // Append the circle to the timeline
        timelineBar.appendChild(eventCircle);
    });

    // Populate the dropdown for membernames
    const membernamesDropdown = document.createElement('select');
    const attackers = details.chains[cid].chainreport.attackers; // Get the list of attackers
    attackers.forEach((attacker, index) => {
        const memberName = toName(attacker.id); // Get the name using the toName function
        const option = document.createElement('option');
        option.value = memberName; // Name as value
        option.textContent = memberName; // Name as text for display
        membernamesDropdown.appendChild(option);
    });

    // Highlight events when a member is selected from the dropdown
    membernamesDropdown.onchange = function() {
        const selectedName = this.value;
        highlightMemberEvents(cid, selectedName);
    };

    console.log("==details.details[cid].chainreport.attackers[0].id");
    console.log(toName(details.chains[cid].chainreport.attackers[0].id));

    // Append the dropdown to the parent element for this chain ID
    const targetElementParent = document.getElementById(cid);
    const targetElement = targetElementParent.querySelector('#display-timeline');
    targetElement.appendChild(membernamesDropdown);
}

// Highlight events for a specific member
function highlightMemberEvents(cid, memberName) {
    const events = document.querySelectorAll(`#timeline-${cid} .event-circle`);
    events.forEach(event => {
        // Compare the value of the data-name attribute to the selected member's name
		
        if (event.getAttribute('data-name') === memberName) {
            event.style.transform = 'scale(1.1)'; // Enlarge the event circle
            event.style.zIndex = '10'; // Optional: Bring to front if needed
			event.style.backgroundColor="teal";
			event.style.border="2px solid gold";
			
        } else {
            event.style.transform = 'scale(1)'; // Reset other events
            event.style.zIndex = '0'; // Reset zIndex
        }
    });
}

// Toggle between Horizontal and Vertical Timeline
function toggleTimelineView(cid) {
  const timelineContainer = document.getElementById(`timeline-${cid}`);
  if (timelineContainer.style.flexDirection === 'column') {
    timelineContainer.style.flexDirection = 'row';
  } else {
    timelineContainer.style.flexDirection = 'column';
  }
}










