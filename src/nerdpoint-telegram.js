'use strict';

let TelegramBot = require('node-telegram-bot-api');
let nerdpoints = require("./nerdpoints-service");

let bot = new TelegramBot(process.env.TELEGRAM_TOKEN || "308329885:AAEnbpe_o-3868ESwZxPUgjtQZXDMPvWz4E", { polling: true });

let validPayload = (msg) => {
	if(msg.entities.length > 0 && msg.entities.find( (entity) => { return entity.type == "text_mention" || entity.type == "mention" }) != undefined) {
		let user = msg.entities.find( (entity ) => { return entity.type == "text_mention" || entity.type == "mention" });
		user = user.user ? user.user : { id :  msg.text.substr(user.offset, user.length) };
		let pointsRaw = /[\+\-]?\d+/.exec(msg.text);
		if(pointsRaw) {
			let sign = /[\+\-]?/.exec(pointsRaw[0])[0];
			let points = parseInt(/\d+/.exec(pointsRaw[0])[0]) | 0;
            points = points > 100 ? 100 : points;
			return {"user" : user, "points" : points, "isAddition" : sign == "+" || sign == 0};
		} else {
			return undefined;
		}
	} else {
		return undefined;
	}
};

let userToString = (user) => {
    return user.first_name && user.last_name ? `${user.first_name} ${user.last_name}` : (user.first_name ? user.first_name : user.id);
};

let vote = async (msg, action) => {
	try {
		let data = await nerdpoints.vote(msg.from.id, action)
		if(data.isRemoved) {
			nerdpoints.get(true).then((list) => {
				bot.sendMessage(msg.chat.id, `Se *${action == nerdpoints.APPROVE ? "aprobó" : "denegó"}*! los *${data.isAddition ? '+' : '-'}${data.points}* de *${userToString(data.user)}*\n\nLa lista quedó:\n${list}` , { parse_mode : "Markdown" });
			})
		} else {
			bot.sendMessage(msg.chat.id, `${action == nerdpoints.APPROVE ? "Aprobado" : "Denegado"}!!! los *${data.isAddition ? '+' : '-'}${data.points}* de *${userToString(data.user)} Falta 1 voto mas!!*`, {parse_mode : "Markdown"});
		}
	} catch(err) {
		if(err.code == 1) {
			bot.sendMessage(msg.chat.id, `${userToString(msg.from)} ya votaste para los ${err.data.points} puntos de ${userToString(err.data.user)}. GATO!!!!`, { parse_mode : "Markdown" })
		} else if (err.code == 2) {
			bot.sendMessage(msg.chat.id, `No te podes votar a vos ameeeeeeoooooo!!!`, { parse_mode : "Markdown" })
		} else {
			console.error(err);
			bot.sendMessage(msg.chat.id, "Ups!! algo salio mal");
		}
	}
};

bot.onText(/\/nerdpoint (\@)*[\w\s]+ [\+\-]?\d+/, async (msg, match) => {
	let data = validPayload(msg);
	if(data) {
		try {
			let result = await nerdpoints.push(data.user, data.points, data.isAddition)
        	bot.sendMessage(msg.chat.id, `Votacion para ${data.isAddition ? 'agregar' : 'restarle'} ${data.points} puntos a ${userToString(data.user)}`, { parse_mode : "Markdown" });
		} catch(err) {
			bot.sendMessage(msg.chat.id, "Nope!");
		}
	} else {
		bot.sendMessage(msg.chat.id, "Lo mandaste mal, tenes que mandar \"/nerdpoint @User (usando mention) +/-cantidad de puntos\". Por ejemplo : +10 o -10");
	}
});

bot.onText(/\/nerdpoints/, async (msg, match) => {
	let data = await nerdpoints.get(true)
	bot.sendMessage(msg.chat.id, data, { parse_mode : "Markdown" });
});


bot.onText(/\/approve/, async (msg, match) => {
    vote(msg, nerdpoints.APPROVE);
});

bot.onText(/\/deny/, async (msg, match) => {
    vote(msg, nerdpoints.DENY)
});

bot.onText(/\/current/, async (msg, match) => {
	console.log("Incoming current commando");
	try {
		let data = await nerdpoints.currents(true)
		let text = "";
		console.log("get currents from service", data);
		data.forEach((item, index) => {
			let approves = item.value.approve ? 1 : 0;
			let deny = item.value.deny ? 1 : 0;
			text += `${index + 1} - ${userToString(item.value.user)} *${item.value.isAddition ? "+" : "-"}${item.value.points}* A : *${approves}* D: *${deny}* ${index == 0 ? "* <= Actual*" : ""}\n`
		});
		console.log("ChatID : ", msg.chat.id, "Text", text);
		bot.sendMessage(msg.chat.id, text, {parse_mode : "Markdown"});
	} catch(err) {
		console.error(err);
		if(err.code == 1) {
			bot.sendMessage(msg.chat.id, "No hay votación vigente, manda nerdpoint para agregar una votación nueva mulo!!!");
		} else {
			bot.sendMessage(msg.chat.id, "Ups!! algo salio mal");
		}
	}
});

bot.onText(/\/lastmonth/, async (msg, match) => {
	try {
		let data = await nerdpoints.lastMonth();
		bot.sendMessage(msg.chat.id, data, {parse_mode : "Markdown"});
	} catch(err) {
		bot.sendMessage(msg.chat.id, "Algo salio mal amiguuu", {parse_mode : "Markdown"});
	}
});
