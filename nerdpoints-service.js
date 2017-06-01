'use strict';

let firebase = require('firebase');

let app = firebase.initializeApp({
	apiKey: process.env.FIREBASE_API_KEY,
	authDomain: process.env.FIREBASE_AUTH_DOMAIN,
	databaseURL: process.env.FIREBASE_DATABASE_URL,
	storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID
});

const MAX_APPROVES = 2;
const APPROVE = "approve";
const DENY = "deny";

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

let get = (prettyPrint) => {
	return ref.once("value").then((data) => { return prettyPrint ? pretty(data) : data });
};

let createError = (code, msg, data) => {
	let error = new Error();
	error.code = code;
	error.message = msg;
	error.data = data;
	return error;
};

let add = (user, points, isAddition) => {
	return ref.child(user.id).once("value")
		.then((data) => {
			let userData = data.val();
			if(userData) {
				userData.points = isAddition ? parseInt(userData.points + points) : parseInt(userData.points - points);
				ref.child(user.id).update(userData);
				return get(true);
			} else {
				ref.child(user.id).set({name : `${user.first_name} ${user.last_name}`, points : isAddition ? points : -1 * points})
				return get(true)
			}
		})
};

let push = (user, points, isAddition) => {
	return root.ref("current").push({"user": user, "points": points, "isAddition": isAddition})
};

let current = (n) => {
	return new Promise((res, rej) => {
		if(currentValues.length > 0 && !n) {
			res(currentValues[0]);
		} else if(n && currentValues.length >= n) {
			res(currentValues.slice(0, n));
		} else if(n && currentValues.length > 0 && currentValues.length <= n) {
			res(currentValues.slice(0, currentValues.length));
		} else if(currentValues.length == 0){
			rej(createError(1, "No current data", null));
		} else {
			rej(createError(1, "No current data", null));
		}
	});
};

let currents = () => {
	return new Promise((res, rej) => {
		if(currentValues.length > 0) {
			res(currentValues)
		} else {
			rej(createError(1, "No current data", null));
		}
	});
}


var vote = (user, action) => {
   return current()
		.then((current) => {
			let firstKey = current.key
			let cur = current.value;

			if(cur.user.id == user) {
				throw createError(2, "No te podes votar a vos ameo!", cur);
			} else if(!cur[action]) {
				cur[action] = {}; cur[action][user] = 1;
				return root.ref(`current/${firstKey}`).update(cur).then((data) => {return cur});
			} else if(cur[action][user]) {
				throw createError(1, "el usuario ya voto", cur);
			} else if(action == APPROVE && Object.keys(cur[action]).length == MAX_APPROVES - 1) {
				return add(cur.user, cur.points, cur.isAddition)
					.then(() => {
						return root.ref(`current/${firstKey}`).remove();
					})

					.then(() => {
						cur.isRemoved = true;
						return cur;
					})

					.catch((err) => {
						throw err;
					})
			} else if(action == DENY && Object.keys(cur[action]).length == MAX_APPROVES - 1) {
				return root.ref(`current/${firstKey}`).remove()

					.then(() => {
						cur.isRemoved = true;
						return cur;
					})

					.catch((err) => {
						throw err;
					})
			}
		})
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

let reset = () => {
	let d = new Date();
	let newKey = `/history/${d.toLocaleString("en-US", { month: "long" }).toLowerCase() + "-" + d.getFullYear()}`;
	root.ref("users").orderByChild("points").once("value")
		.then((snapshot) => {
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
		});
}

let lastMonth = () => {
    let d = new Date(); d.setMonth(d.getMonth() - 1);
    let key = `/history/${d.toLocaleString("en-US", { month: "long" }).toLowerCase() + "-" + d.getFullYear()}`;
    return root.ref(key).orderByChild("points").once('value')
        .then((s) =>{
            let users = [];
            s.forEach((childSnap) => {
                users.id = childSnap.key;
                users.push(childSnap.val());
            })
            let result = `Resultados del mes de ${d.toLocaleString("es-AR", { month: "long" })} : \n\n`
            users = users.reverse()
            users.forEach((user, i) => {
                result += `${user.name} : *${user.points}*${i == 0 ? '*<= Ganó*' : ''}\n`;
            })
            return result;
        })
}

module.exports = {
    add : add,
    get : get,
    current : current,
    currents : currents,
    push : push,
    vote : vote,
    reset : reset,
    lastMonth : lastMonth,
    APPROVE : APPROVE,
    DENY : DENY
};
