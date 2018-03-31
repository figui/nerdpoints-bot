'use strict';

let firebase = require('firebase');

let app = firebase.initializeApp({
	// apiKey: process.env.FIREBASE_API_KEY,
	// authDomain: process.env.FIREBASE_AUTH_DOMAIN,
	// databaseURL: process.env.FIREBASE_DATABASE_URL,
	// storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
	// messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID
	apiKey: "AIzaSyBtNChDxncrZCqAfN2kl6YtSEjrgSO8mh8",
    authDomain: "nerdpoint-ef650.firebaseapp.com",
    databaseURL: "https://nerdpoint-ef650.firebaseio.com",
    projectId: "nerdpoint-ef650",
    storageBucket: "nerdpoint-ef650.appspot.com",
    messagingSenderId: "638962803741"
});

const MAX_APPROVES = 2;
export const APPROVE = "approve";
export const DENY = "deny";
const TRANSLATED_MONTHS = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

let root = app.database();
let ref = root.ref("users");
let currentValues = [];

let currentRef = root.ref("current");

currentRef.on("child_added", (data)=>{
	currentValues.push({key : data.key, value : data.val()});
});

currentRef.on("child_removed", (data)=>{
	currentValues = currentValues.filter((item) => { return item.key != data.key });
});

currentRef.on("child_changed", (data)=>{
	currentValues.forEach((item) => { if(item.key == data.key) { item.value = data.val() } })
});

export let get = async (prettyPrint) => {
	let data = await ref.once("value");
	return prettyPrint ? pretty(data) : data
	// return ref.once("value").then((data) => { return prettyPrint ? pretty(data) : data });
};

let createError = (code, msg, data) => {
	let error = new Error();
	error.code = code;
	error.message = msg;
	error.data = data;
	return error;
};

export let add = async (user, points, isAddition) => {
	let data = await ref.child(user.id).once("value")
	let userData = data.val();
	if(userData) {
		userData.points = isAddition ? parseInt(userData.points + points) : parseInt(userData.points - points);
		ref.child(user.id).update(userData);
		return get(true);
	} else {
		ref.child(user.id).set({name : `${user.first_name} ${user.last_name}`, points : isAddition ? points : -1 * points})
		return get(true)
	}
};

export let push = (user, points, isAddition) => {
	return root.ref("current").push({"user": user, "points": points, "isAddition": isAddition})
};

export let current = (n) => {
	if(currentValues.length > 0 && !n) {
		return currentValues[0]
	} else if(n && currentValues.length >= n) {
		return currentValues.slice(0, n);
	} else if(n && currentValues.length > 0 && currentValues.length <= n) {
		return currentValues.slice(0, currentValues.length);
	} else if(currentValues.length == 0){
		throw createError(1, "No current data", null);
	} else {
		throw createError(1, "No current data", null);
	}
};

export let currents = () => {
	return new Promise((res, rej) => {
		if(currentValues.length > 0) {
			res(currentValues)
		} else {
			rej(createError(1, "No current data", null));
		}
	});
}


export let vote = async (user, action) => {
	try {
		let c = current()
		let firstKey = c.key
		let cur = c.value;

		if(cur.user.id == user) {
			throw createError(2, "No te podes votar a vos ameo!", cur);
		} else if(!cur[action]) {
			cur[action] = {}; cur[action][user] = 1;
			return await root.ref(`current/${firstKey}`).update(cur)
		} else if(cur[action][user]) {
			throw createError(1, "el usuario ya voto", cur);
		} else if(action == APPROVE && Object.keys(cur[action]).length == MAX_APPROVES - 1) {
			await add(cur.user, cur.points, cur.isAddition)
			await root.ref(`current/${firstKey}`).remove();
			cur.isRemoved = true;
			return cur;

		} else if(action == DENY && Object.keys(cur[action]).length == MAX_APPROVES - 1) {
			await root.ref(`current/${firstKey}`).remove()
			cur.isRemoved = true;
			return cur;
		}
	} catch(err) {
		throw err;
	}	
};

let pretty = (persons) => {
	let users = [];
	persons.forEach((child) => {
		users.push(child.val ? child.val() : child)
	});
	users = sort(users);
	let result = "";
	for(let user in users) {
		result += `${users[user].name} : *${users[user].points}*\n`;
	}
	return result;
};

let sort = (list) => {
	return list.sort((a,b) => { return a["points"] > b["points"] ? -1 : (a["points"] < b["points"] ? 1 : 0) });
}

export let reset = async () => {
	let d = new Date();
	let newKey = `/history/${d.toLocaleString("en-US", { month: "long" }).toLowerCase() + "-" + d.getFullYear()}`;
	let snapshot = await root.ref("users").orderByChild("points").once("value")
	let users = []
	snapshot.forEach((childSnapshot) => {
		var key = childSnapshot.key;
		var childData = childSnapshot.val();
		childData.id = key;
		users.push(childData);
		root.ref(`/users/${key}`).set({name : childData.name, points : 0})
	});
	users.reverse();

	users.forEach((user) => {
		console.log(`${newKey}/${user.id}`);
		root.ref(`${newKey}/${user.id}`)
		.set({name : user.name, points : user.points})
	});
	root.ref(`${newKey}/winner`).set({name : users[0].name, points : users[0].points })
}

export let lastMonth = async () => {
    let d = new Date();
    let key = `/history/${d.toLocaleString("en-US", { month: "long" }).toLowerCase() + "-" + d.getFullYear()}`;
    let s = await root.ref(key).orderByChild("points").once('value')
    let users = [];
	s.forEach((childSnap) => {
		if(childSnap.key != "winner") {
			users.id = childSnap.key;
			users.push(childSnap.val());
		}
	})
	d.setMonth(d.getMonth() - 1);
	let result = `Resultados del mes de ${TRANSLATED_MONTHS[d.getMonth()]} : \n\n`
	users = users.reverse()
	users.forEach((user, i) => {
		result += `${user.name} : *${user.points}*${i == 0 ? ' *<= Ganó*' : ''}\n`;
	})
	return result;
}