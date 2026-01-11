let apikey;
let membernames;
const display_defends=false;
const our_faction_id = 35840;
let details = {};
const our_faction_name = "Baby Champers";
const BONUS_CHAINS = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000];
let cFAD;
const api_rate = 1000; // divide by 1000 for seconds


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
	//console.log(`Running toggle(${id},${which})`);
	const target = document.getElementById(id) ?? document.getElementById("custom");
	//console.log(`Target element: ${target}`);
	const subtarget = target.querySelector(`#${which}`);
	//console.log(`Subtarget element: ${subtarget}`);
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
      await new Promise(res => setTimeout(res, api_rate));
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
		//console.log(`Loaded detailed report for chain ${id} from cache.`);
		document.getElementById(`loadingMessage-${id}`).innerHTML="";
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
		//console.log("details.details[id] already exists");
	} else {
		// create it
		details.details[id] = fullAttackList;
		//console.log("details.details exists, but [id] did not. Created.");
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
			<tbody class="detailed-entry-group">
				<tr style="background-color:#84a4ff" class="head-row">
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
				<tr style="background-color:#84a4ff" class="body-row">
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
			</tbody>
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
			<tbody class="detailed-entry-group">
				<tr style="background-color:#c54545" class="head-row">
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
				<tr style="background-color:#c54545" class="body-row">
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
			</tbody>
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
		
		//init filiters
		initDetailedFilters();
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
			<tbody class="detailed-entry-group">
				<tr style="background-color:#84a4ff" class="head-row">
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
				<tr style="background-color:#84a4ff" class="body-row">
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
			</tbody>
				
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
			<tbody class="detailed-entry-group">
				<tr style="background-color:#c54545" class="head-row">
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
				<tr style="background-color:#c54545" class="body-row">
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
			</tbody>
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
		
		//init filters
		initDetailedFilters();

	}
	
	// Pseudo retro Torn style
	const perPlayerStats = buildPerPlayerStats(fullAttackList.attacks);
	const tornTableHTML = renderCustomTornStyleTable(perPlayerStats);
	document.querySelector("#custom #display-torn").innerHTML = tornTableHTML;

	
	fill_custom_chain_data(start,end,fullAttackList);
	cFAD=fullAttackList;

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

		//console.log("Start UNIX epoch (sec):", start);
		//console.log("End UNIX epoch (sec):", end);

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

function buildPerPlayerStats(attacks) {
    const stats = {};
    
    for (const atk of attacks) {
        // Skip invalid or incomplete entries
        if (!atk.attacker || !atk.defender) continue;
        if (!atk.attacker.faction || atk.attacker.faction.name !== our_faction_name) continue;

        const id = atk.attacker.id;
        if (!stats[id]) {
            stats[id] = {
                id,
                name: atk.attacker.name || "Unknown",
                attempts: 0,
                attacks: 0,
                leave: 0,
                mug: 0,
                hospitalize: 0,
                losses: 0,
                escapes: 0,
                draws: 0,
                assists: 0,
                overseas: 0,
                retaliations: 0,
                war: 0,
                bonusHits: 0,
                respect: 0,
                baselineRespect: 0,
				interrupted: 0,
				timeout: 0
            };
        }

        const s = stats[id];
        s.attempts++;

        // Normalize result
        const result = (atk.result || "").toLowerCase();

		const expected = ["attacked","mugged","hospitalized","lost","escape","stalemate","assist","interrupted","timeout"];
		if(!expected.includes(result)) {console.log(`Alert: unique outcome detected: ${result}`)};

        switch (result) {
            case "attacked":
                s.attacks++;
                s.leave++;
                break;
            case "mugged":
                s.attacks++;
                s.mug++;
                break;
            case "hospitalized":
                s.attacks++;
                s.hospitalize++;
                break;
            case "lost":
                s.losses++;
                break;
            case "escape":
                s.escapes++;
                break;
            case "stalemate":
                s.draws++;
                break;
            case "assist":
                s.assists++;
                break;
			case "interrupted":
				s.interrupted++;
				break;
			case "timeout":
				s.timeout++;
				break;
        }

		if (atk.modifiers?.overseas > 1) s.overseas++;
		if (atk.modifiers?.retaliation > 1) s.retaliations++;
        if (atk.is_ranked_war) s.war++;

        const respectGain = atk.respect_gain || 0;
        s.respect += respectGain;

        // Bonus milestone logic
        if (BONUS_CHAINS.includes(atk.chain)) {
            s.bonusHits++;
        } else {
            s.baselineRespect += respectGain;
        }
    }

    return Object.values(stats);
}
function renderCustomTornStyleTable(perPlayerStats) {
    if (!perPlayerStats || perPlayerStats.length === 0) {
        return `<div style="text-align:center;padding:10px;">No outgoing attacks found in this timeframe.</div>`;
    }

    // Calculate totals
    const totals = {
        attempts: 0, attacks: 0, leave: 0, mug: 0, hospitalize: 0,
        losses: 0, escapes: 0, draws: 0, assists: 0, overseas: 0,
        retaliations: 0, war: 0, bonusHits: 0, respect: 0, baselineRespect: 0,
		interrupted: 0, timeout: 0
    };

    for (const s of perPlayerStats) {
        totals.attempts += s.attempts;
        totals.attacks += s.attacks;
        totals.leave += s.leave;
        totals.mug += s.mug;
        totals.hospitalize += s.hospitalize;
        totals.losses += s.losses;
        totals.escapes += s.escapes;
        totals.draws += s.draws;
        totals.assists += s.assists;
        totals.overseas += s.overseas;
        totals.retaliations += s.retaliations;
        totals.war += s.war;
        totals.bonusHits += s.bonusHits;
        totals.respect += s.respect;
        totals.baselineRespect += s.baselineRespect;
		totals.interrupted += s.interrupted;
		totals.timeout += s.timeout;
    }

    let html = `
    <table class="chainTable" style="width:100%;border-collapse:collapse;text-align:center;">
        <thead>
            <tr>
                <th>Player</th>
                <th title="Contains all actions including assists">Attempts</th>
                <th title="Contains: Attacked, Mugged, Hospitalized, Leave">Attacks</th>
                <th>Leave</th>
                <th>Mug</th>
                <th>Hospitalize</th>
                <th>Losses</th>
                <th>Escapes</th>
                <th>Draws</th>
				<th>Interrupted</th>
				<th>Timeout</th>
                <th>Assists</th>
                <th>Overseas</th>
                <th>Retaliations</th>
                <th>War Hits</th>
                <th>Bonus Hits</th>
                <th>Respect</th>
                <th title="Respect minus bonus hits">Baseline Respect</th>
            </tr>
        </thead>
        <tbody>`;

    // Total row
    html += `
        <tr class="total" style="font-weight:bold;">
            <td>Total</td>
            <td>${totals.attempts}</td>
            <td>${totals.attacks}</td>
            <td>${totals.leave}</td>
            <td>${totals.mug}</td>
            <td>${totals.hospitalize}</td>
            <td>${totals.losses}</td>
            <td>${totals.escapes}</td>
            <td>${totals.draws}</td>
			<td>${totals.interrupted}</td>
			<td>${totals.timeout}</td>
            <td>${totals.assists}</td>
            <td>${totals.overseas}</td>
            <td>${totals.retaliations}</td>
            <td>${totals.war}</td>
            <td>${totals.bonusHits}</td>
            <td>${Math.floor(totals.respect)}</td>
            <td>${Math.floor(totals.baselineRespect)}</td>
        </tr>`;

    // Player rows
    for (const s of perPlayerStats.sort((a, b) => b.respect - a.respect)) {
        html += `
        <tr>
            <td><a href="https://www.torn.com/profiles.php?XID=${s.id}" target="_blank">${s.name}</a></td>
            <td>${s.attempts}</td>
            <td>${s.attacks}</td>
            <td>${s.leave}</td>
            <td>${s.mug}</td>
            <td>${s.hospitalize}</td>
            <td>${s.losses}</td>
            <td>${s.escapes}</td>
            <td>${s.draws}</td>
			<td>${s.interrupted}</td>
			<td>${s.timeout}</td>
            <td>${s.assists}</td>
            <td>${s.overseas}</td>
            <td>${s.retaliations}</td>
            <td>${s.war}</td>
            <td>${s.bonusHits}</td>
            <td>${Math.floor(s.respect)}</td>
            <td>${Math.floor(s.baselineRespect)}</td>
        </tr>`;
    }

    html += `
		<tr>Nonhitters not available due to nature of custom reports.</tr>
        </tbody>
    </table>`;

    return html;
}


async function fill_custom_chain_data(start,end,FAD) {
	//console.log("Full attack data available to fill_custom_chain_data:");
	//console.log(FAD);
	const CUSTOM = buildCustomStats(FAD.attacks);
	//console.log("CUSTOM:");
	//console.log(CUSTOM);
	// --- Format bonuses into HTML before defining header ---
	let bonusHTML = "";

	if (CUSTOM.bonuses && Object.keys(CUSTOM.bonuses).length > 0) {
		const steps = Object.keys(CUSTOM.bonuses).map(Number).sort((a, b) => a - b);

		for (const step of steps) {
			const players = CUSTOM.bonuses[step];
			const names = players.length ? players.join(", ") : "—";

			bonusHTML += `
            <td style="vertical-align:top; padding:6px; border:1px solid #444;">
                <div style="font-weight:bold; padding:4px;">${step}</div>
                <div style="padding:4px;">${names}</div>
            </td>
        `;
		}
	} else {
		bonusHTML = `<tr></tr>`;
	}

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
        <td>${Math.floor(CUSTOM.respectRounded)}</td>
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
	    ${bonusHTML}
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
		<button onclick="generate_custom_timeline();">Generate</button>
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
		//console.log(`found ${keyToCheck} in db chains`);
	} else {
		//console.log(`could not find ${keyToCheck} in db chains`);
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
  
  

  //console.log('Selected CIDs:', selectedCIDs);
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
      <tbody><tr>
	    <td>${chaindata.id}</td>
        <td>${TCT(chaindata.start)}</td>
        <td>${TCT(chaindata.end)}</td>
		<td>${formatDuration(chaindata.start,chaindata.end)}</td>
        <td>${respectRounded}</td>
        <td>${lengthRounded}</td></tr>
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
	//console.log("Chaindata:");
	//console.log(chaindata);
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

async function generate_custom_timeline() {
	const containerId='custom';
	const attackData=cFAD;
    const targetElement = document.getElementById(containerId);
    if (!targetElement) return;

    const start = parseInt(targetElement.dataset.start, 10);
    const end = parseInt(targetElement.dataset.end, 10);

    // Create Timeline Container
    const timelineContainer = document.createElement('div');
    timelineContainer.id = `timeline-${containerId}`;
    targetElement.appendChild(timelineContainer);

    // Create the timeline bar
    const timelineBar = document.createElement('div');
    timelineBar.style.position = 'relative';
    timelineBar.style.width = '100%';
    timelineBar.style.height = '50px';
    timelineBar.style.background = '#f0f0f0';
    timelineBar.style.border = '1px solid #ccc';
    timelineContainer.appendChild(timelineBar);

    // Filter events
    const validResults = ["Attacked", "Mugged", "Hospitalized"];
    attackData.attacks.forEach(attack => {
        if (!validResults.includes(attack.result)) return;

        const eventTime = attack.ended;
        if (!eventTime || eventTime < start || eventTime > end) return;

        const eventPosition = ((eventTime - start) / (end - start)) * 100;

        // Create a thin vertical line
        const eventLine = document.createElement('div');
        eventLine.style.position = 'absolute';
        eventLine.style.left = `${eventPosition}%`;
        eventLine.style.top = '15%';         // Slightly inset from top
        eventLine.style.height = '70%';      // Not full height, looks nicer
        eventLine.style.width = '2px';
        eventLine.style.borderRadius = '1px';
        eventLine.style.opacity = '0.9';

        // Determine color based on defender faction
        const defenderFaction = attack.defender?.faction?.name || "Unknown";
        eventLine.style.backgroundColor =
            (defenderFaction === our_faction_name) ? 'red' : 'green';

        // Determine attacker/defender names with fallbacks
        const attackerName = attack.attacker?.name || "Someone";
        const defenderName = attack.defender?.name || "Someone";

        // Tooltip
        const tooltip = document.createElement('div');
        tooltip.innerHTML = `
            <strong>${attackerName}</strong> → <strong>${defenderName}</strong><br>
            <em>${attack.result}</em>
        `;
        tooltip.style.position = 'absolute';
        tooltip.style.bottom = '55px'; // Show above the timeline
        tooltip.style.left = '50%';
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.visibility = 'hidden';
        tooltip.style.background = '#333';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '5px';
        tooltip.style.borderRadius = '5px';
        tooltip.style.whiteSpace = 'nowrap';
        tooltip.style.fontSize = '12px';
        tooltip.style.zIndex = '10';
        eventLine.appendChild(tooltip);

        // Tooltip hover behavior
        eventLine.onmouseover = () => tooltip.style.visibility = 'visible';
        eventLine.onmouseout = () => tooltip.style.visibility = 'hidden';

        // Append to timeline
        timelineBar.appendChild(eventLine);
    });
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


document.addEventListener("click", function (e) {
  const headerCell = e.target.closest("th");
  if (!headerCell) return;

  // Hardcode non-sortable headers by text
  const nonSortableHeaders = ["Chain ID", "Start Time", "End Time", "Duration"];
  if (nonSortableHeaders.includes(headerCell.textContent.trim())) return;

  const table = headerCell.closest("table");
  if (!table) return;
  const tbody = table.querySelector("tbody");
  if (!tbody) return;

  const colIndex = Array.from(headerCell.parentNode.children).indexOf(headerCell);

  // Determine sort direction
  const isSameColumn = headerCell.classList.contains("asc") || headerCell.classList.contains("desc");
  const isAscending = isSameColumn ? !headerCell.classList.contains("asc") : true;
  const direction = isAscending ? 1 : -1;

  // Reset header states
  table.querySelectorAll("th").forEach(th => th.classList.remove("asc", "desc"));
  headerCell.classList.add(isAscending ? "asc" : "desc");

  // Separate total row
  const rows = Array.from(tbody.querySelectorAll("tr")).filter(row => !row.classList.contains("total"));
  const totalRow = tbody.querySelector("tr.total");

  // Sort rows
  rows.sort((a, b) => {
    const cellA = a.cells[colIndex]?.textContent.trim() || "";
    const cellB = b.cells[colIndex]?.textContent.trim() || "";

    const numA = parseFloat(cellA);
    const numB = parseFloat(cellB);

    if (!isNaN(numA) && !isNaN(numB)) {
      return (numA - numB) * direction;
    }
    return cellA.localeCompare(cellB) * direction;
  });

  // Rebuild tbody
  rows.forEach(row => tbody.appendChild(row));
  if (totalRow) tbody.prepend(totalRow); // Keep total on top
});

function initDetailedFilters() {
    injectFilterUI();

    // Find correct report container for this filter UI
	let container = null;
	// 1. Filter UI lives in #footer.
	// Find the detailed_entry *just before* the footer.
	const footer = document.getElementById("footer");
	if (footer) {
		const previousEntry = footer.previousElementSibling;
		if (previousEntry && previousEntry.classList.contains("detailed_entry")) {
			container = previousEntry.querySelector("#display-detailed");
		}
	}
	// 2. If still not found, fall back to the last detailed_entry on the page.
	if (!container) {
		const allEntries = document.querySelectorAll(".detailed_entry");
		const lastEntry = allEntries[allEntries.length - 1];
		if (lastEntry) {
			container = lastEntry.querySelector("#display-detailed");
		}
	}
	// 3. Final fallback (should never be needed anymore)
	if (!container) {
		container = document.querySelector("#display-detailed");
	}
	if (!container) return;



    const table = container.querySelector("table");
    if (!table) return;

    // Build row pairs from each tbody.detailed-entry-group
    const entryTBodies = Array.from(table.querySelectorAll("tbody.detailed-entry-group"));
    const rowPairs = entryTBodies.map(tb => {
        const rows = tb.querySelectorAll("tr");
        if (rows.length < 2) return null;
        const [head, body] = rows;
        head.classList.add("head-row");
        body.classList.add("body-row");
        return { tb, head, body };
    }).filter(Boolean);

    const totalEntries = rowPairs.length;
    const loadingMsg = getLoadingMessageElement();

    // Hook up UI
    document.getElementById("filter-apply").onclick = applyFilters;
    document.getElementById("filter-clear").onclick = clearFilters;

    //applyFilters();

    // Utilities
    function getColText(row, index) {
        const td = row.querySelectorAll("td")[index];
        return td ? td.textContent.trim() : "";
    }

    function textToBool(t) {
        t = t.toLowerCase();
        return (t === "true" || t === "1" || t === "yes");
    }

    function timeToSec(t) {
        if (!t || !t.includes(":")) return null;
        const [m, s] = t.split(":").map(x => parseInt(x));
        return m * 60 + s;
    }

    /*function applyFilters() {
    const name1 = document.getElementById("filter-name1").value.trim().toLowerCase();
    const name2 = document.getElementById("filter-name2").value.trim().toLowerCase();
    const faction = document.getElementById("filter-faction").value.trim().toLowerCase();
    const respectType = document.getElementById("filter-respect-type").value;
    const respectVal = parseFloat(document.getElementById("filter-respect-value").value);
    const fStealth = document.getElementById("filter-stealth").value;
    const fWar = document.getElementById("filter-war").value;
    const fRaid = document.getElementById("filter-raid").value;
    const fInt = document.getElementById("filter-interrupted").value;
    const effectsStr = document.getElementById("filter-effects").value.trim().toLowerCase();
    const ctComp = document.getElementById("filter-ct-comparator").value;
    const ctVal = timeToSec(document.getElementById("filter-ct-value").value);
    const typeFilter = document.getElementById("filter-type").value;

    let visibleCount = 0;

    rowPairs.forEach(({ tb, head, body }, i) => {
        const htd = head.querySelectorAll("td");
        const btd = body.querySelectorAll("td");

        // Column mapping
        const attacker = htd[1]?.textContent.toLowerCase() || "";
        const defender = htd[3]?.textContent.toLowerCase() || "";
        const attackerFaction = btd[1]?.textContent.toLowerCase() || "";
        const defenderFaction = btd[3]?.textContent.toLowerCase() || "";
        const respect = parseFloat(btd[4]?.textContent || "0");
        const stealth = textToBool(btd[5]?.textContent || "");
        const war = textToBool(btd[6]?.textContent || "");
        const raid = textToBool(btd[7]?.textContent || "");
        const interrupt = textToBool(btd[8]?.textContent || "");
        const effects = btd[9]?.textContent.toLowerCase() || "";
        const chainTimer = btd[19]?.textContent.trim() || "";
        const ctSec = timeToSec(chainTimer);
        const ourFaction = our_faction_name.toLowerCase();
        const isAtk = attackerFaction === ourFaction;
        const isDef = defenderFaction === ourFaction;

        // FILTERS
        let hideEntry = false;

        if (name1 && !(attacker.includes(name1) || defender.includes(name1))) hideEntry = true;
        if (name2 && !(attacker.includes(name2) || defender.includes(name2))) hideEntry = true;
        if (faction && !(attackerFaction.includes(faction) || defenderFaction.includes(faction))) hideEntry = true;
        if (typeFilter === "atk" && !isAtk) hideEntry = true;
        if (typeFilter === "def" && !isDef) hideEntry = true;

        if (respectType !== "ignore" && !isNaN(respectVal)) {
            if (respectType === "gt" && !(respect > respectVal)) hideEntry = true;
            if (respectType === "lt" && !(respect < respectVal)) hideEntry = true;
        }

        if (fStealth !== "ignore" && stealth !== (fStealth === "yes")) hideEntry = true;
        if (fWar !== "ignore" && war !== (fWar === "yes")) hideEntry = true;
        if (fRaid !== "ignore" && raid !== (fRaid === "yes")) hideEntry = true;
        if (fInt !== "ignore" && interrupt !== (fInt === "yes")) hideEntry = true;
        if (effectsStr && !effects.includes(effectsStr)) hideEntry = true;

        if (ctComp !== "ignore") {
            if (ctSec === null || ctVal === null) hideEntry = true;
            if (ctComp === "lt" && !(ctSec < ctVal)) hideEntry = true;
            if (ctComp === "gt" && !(ctSec > ctVal)) hideEntry = true;
        }

        // ✅ Toggle tbody display correctly
		console.log("Before hideEntry, check if tb is connected");
		console.log(tb.isConnected); // true if in DOM
        if (hideEntry) {
            //tb.style.display = "none";
			//tb.classList.add("hidden");
			    tb.style.setProperty("display", "none", "important");
				tb.remove();
            console.log(`Hiding entry #${i + 1}: ${attacker} vs ${defender}`);
			console.log("Should be the following object:");
			console.log(tb);
			console.log("-");
        } else {
            //tb.style.display = "table-row-group"; // force proper tbody display
			//tb.classList.remove("hidden");
			    tb.style.setProperty("display", "table-row-group", "important");
            visibleCount++;
            console.log(`Showing entry #${i + 1}: ${attacker} vs ${defender}`);
			console.log("Should be the following object:");
			console.log(tb);
			console.log("-");
        }
    });
	if(document.getElementById("loadingMessage-custom")) {
		document.getElementById("loadingMessage-custom").innerHTML = "Fuck!";
		document.getElementById("loadingMessage-custom").innerHTML = `Showing ${visibleCount} of ${totalEntries}`;
	};
    // ✅ Update the loading message
    if (loadingMsg && loadingMsg instanceof HTMLElement) {
        loadingMsg.innerHTML = `Showing ${visibleCount} of ${totalEntries} attacks`;
		console.log("Loading message : ");
		console.log(loadingMsg);
		console.log(`Updated filter counter to ${visibleCount} / ${totalEntries}`);
    }
	}
*/
	
function applyFilters() {
    const name1 = document.getElementById("filter-name1").value.trim().toLowerCase();
    const name2 = document.getElementById("filter-name2").value.trim().toLowerCase();
    const faction = document.getElementById("filter-faction").value.trim().toLowerCase();
    const respectType = document.getElementById("filter-respect-type").value;
    const respectVal = parseFloat(document.getElementById("filter-respect-value").value);
    const fStealth = document.getElementById("filter-stealth").value;
    const fWar = document.getElementById("filter-war").value;
    const fRaid = document.getElementById("filter-raid").value;
    const fInt = document.getElementById("filter-interrupted").value;
    const effectsStr = document.getElementById("filter-effects").value.trim().toLowerCase();
    const ctComp = document.getElementById("filter-ct-comparator").value;
    const ctVal = timeToSec(document.getElementById("filter-ct-value").value);
    const typeFilter = document.getElementById("filter-type").value;

    let visibleCount = 0;

    // ✅ Grab the live chain div (meta or custom) and attached TBs
    const chainDiv = document.querySelector("#body > div[id]:not(#display-detailed)");
    const rowPairs = Array.from(chainDiv.querySelectorAll(".detailed_entry tbody")).map(tb => ({
        tb,
        head: tb.querySelector(".head-row"),
        body: tb.querySelector(".body-row")
    }));

    rowPairs.forEach(({ tb, head, body }, i) => {
        const htd = head.querySelectorAll("td");
        const btd = body.querySelectorAll("td");

        // Column mapping
        const attacker = htd[1]?.textContent.toLowerCase() || "";
        const defender = htd[3]?.textContent.toLowerCase() || "";
        const attackerFaction = btd[1]?.textContent.toLowerCase() || "";
        const defenderFaction = btd[3]?.textContent.toLowerCase() || "";
        const respect = parseFloat(btd[4]?.textContent || "0");
        const stealth = textToBool(btd[5]?.textContent || "");
        const war = textToBool(btd[6]?.textContent || "");
        const raid = textToBool(btd[7]?.textContent || "");
        const interrupt = textToBool(btd[8]?.textContent || "");
        const effects = btd[9]?.textContent.toLowerCase() || "";
        const chainTimer = btd[19]?.textContent.trim() || "";
        const ctSec = timeToSec(chainTimer);
        const ourFaction = our_faction_name.toLowerCase();
        const isAtk = attackerFaction === ourFaction;
        const isDef = defenderFaction === ourFaction;

        // FILTERS
        let hideEntry = false;

        if (name1 && !(attacker.includes(name1) || defender.includes(name1))) hideEntry = true;
        if (name2 && !(attacker.includes(name2) || defender.includes(name2))) hideEntry = true;
        if (faction && !(attackerFaction.includes(faction) || defenderFaction.includes(faction))) hideEntry = true;
        if (typeFilter === "atk" && !isAtk) hideEntry = true;
        if (typeFilter === "def" && !isDef) hideEntry = true;

        if (respectType !== "ignore" && !isNaN(respectVal)) {
            if (respectType === "gt" && !(respect > respectVal)) hideEntry = true;
            if (respectType === "lt" && !(respect < respectVal)) hideEntry = true;
        }

        if (fStealth !== "ignore" && stealth !== (fStealth === "yes")) hideEntry = true;
        if (fWar !== "ignore" && war !== (fWar === "yes")) hideEntry = true;
        if (fRaid !== "ignore" && raid !== (fRaid === "yes")) hideEntry = true;
        if (fInt !== "ignore" && interrupt !== (fInt === "yes")) hideEntry = true;
        if (effectsStr && !effects.includes(effectsStr)) hideEntry = true;

        if (ctComp !== "ignore") {
            if (ctSec === null || ctVal === null) hideEntry = true;
            if (ctComp === "lt" && !(ctSec < ctVal)) hideEntry = true;
            if (ctComp === "gt" && !(ctSec > ctVal)) hideEntry = true;
        }

        // ✅ Toggle tbody display correctly on live DOM
        if (hideEntry) {
            tb.style.setProperty("display", "none", "important");
            console.log(`Hiding entry #${i + 1}: ${attacker} vs ${defender}`);
        } else {
            tb.style.setProperty("display", "table-row-group", "important");
            visibleCount++;
            console.log(`Showing entry #${i + 1}: ${attacker} vs ${defender}`);
        }
    });

    // ✅ Update the loading message
    const loadingMsg = document.getElementById("loadingMessage-custom") || document.getElementById("loadingMessage");
    if (loadingMsg instanceof HTMLElement) {
        loadingMsg.innerHTML = `Showing ${visibleCount} of ${rowPairs.length} attacks`;
        console.log("Updated loading message:", loadingMsg.innerHTML);
    }
}


	
    function clearFilters() {
        document.querySelectorAll("#detailed-filters input").forEach(i => i.value = "");
        document.querySelectorAll("#detailed-filters select").forEach(s => s.value = "ignore");
        document.getElementById("filter-type").value = "both";
        applyFilters();
    }

    function getLoadingMessageElement() {
        const local = container.querySelector("[id^='loadingMessage-']");
        if (local) return local;
        const custom = document.getElementById("loadingMessage-custom");
        if (custom) return custom;
        return { innerHTML: "" };
    }
}

function injectFilterUI() {
    if (document.getElementById("detailed-filters")) return; // prevent duplicates

    const footer = document.getElementById("footer");
    const filterUI = document.createElement("div");
    filterUI.id = "detailed-filters";
    filterUI.style.marginTop = "10px";
    filterUI.style.padding = "10px";
    filterUI.style.borderTop = "1px solid #333";

    filterUI.innerHTML = `
<div style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
<label>Name #1: <input type="text" id="filter-name1" /></label>
<label>Name #2: <input type="text" id="filter-name2" /></label>
<label>Opponent Faction: <input type="text" id="filter-faction" /></label>
<label>Respect: <select id="filter-respect-type">
<option value="ignore">Ignore</option>
<option value="gt">&gt;</option>
<option value="lt">&lt;</option>
</select>
<input type="number" id="filter-respect-value" style="width:70px;" /></label>
<label>Stealth: <select id="filter-stealth">
<option value="ignore">Ignore</option>
<option value="yes">Yes</option>
<option value="no">No</option>
</select></label>
<label>War: <select id="filter-war">
<option value="ignore">Ignore</option>
<option value="yes">Yes</option>
<option value="no">No</option>
</select></label>
<label>Raid: <select id="filter-raid">
<option value="ignore">Ignore</option>
<option value="yes">Yes</option>
<option value="no">No</option>
</select></label>
<label>Interrupted: <select id="filter-interrupted">
<option value="ignore">Ignore</option>
<option value="yes">Yes</option>
<option value="no">No</option>
</select></label>
<label>Effects contains: <input type="text" id="filter-effects" /></label>
<label>Chain Timer: <select id="filter-ct-comparator">
<option value="ignore">Ignore</option>
<option value="lt">&lt;</option>
<option value="gt">&gt;</option>
</select>
<input type="text" id="filter-ct-value" placeholder="MM:SS" style="width:60px;" /></label>
<label>Type: <select id="filter-type">
<option value="both">Both</option>
<option value="atk">Our Attacks</option>
<option value="def">Our Defends</option>
</select></label>
<button id="filter-apply">Apply</button>
<button id="filter-clear">Clear</button>
</div>
`;

    footer.appendChild(filterUI);
}





setTimeout(() => {
document.getElementById("body").innerHTML+=`
<h3>Current Api rate: 1/s</h3><br>
+Added custom tornstyle overview
<br>
+Added sortable table headers
<br>
*Need to add option to remove localstorage and add disclaimer
<br>
*Need to add filters (name, respect >/< etc)
<br>
*Need a better calendar picking for custom times
<br>
*Make API rate modular
<br>
*Make custom reports saveable?
<br>
`;
},10);


