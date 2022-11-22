'use strict';

require('dotenv').config();
const {
  Telegraf,
  Markup,
} = require('telegraf');
const bot = new Telegraf(process.env.BOT_TOKEN);
const { connectDatabase, users } = require('./db.js');
const myConsts = require('./consts');
connectDatabase();
let obj;
let tasksList;
let taskText;
let taskId;
let action = '';
bot.start(async (ctx) => {
  await ctx.reply(`Привет ${ctx.message.from.first_name}, этот бот создан для планировки задач.\nНапиши команду /help, чтобы узнать команды бота.`);
  const userExists = await users.findOne({ username: ctx.message.from.username });
  if (userExists === null) users.insertOne({ username: `${ctx.message.from.username}`, chatId: `${ctx.chat.id}`, tasks: [] });
});

bot.help((ctx) => ctx.reply(myConsts.commands));

bot.command('addTask', async (ctx) => {
  try {
    await addTask(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.command('myTasks', async (ctx) => {
  try {
    await myTasks(ctx);
  } catch (e) {
    console.log(e);
  }
});

bot.command('deleteTask', async (ctx) => {
  try {
    await deleteTask(ctx);
  } catch (e) {
    console.log(e);
  }
});

async function updateData(ctx) {
  obj = await users.findOne({ chatId: String(ctx.chat.id) });
  tasksList = obj.tasks;
}

async function addTask(ctx) {
  updateData(ctx);
  await ctx.reply('Напишите задачу');
  bot.hears(/\D/, async (ctx) => {
    taskText = ctx.message.text;
    action = 'add';
    await ctx.replyWithHTML(
      'Вы действительно хотите добавить задачу:\n\n' +
        `<i>${ctx.message.text}</i>`,
      yesNoKeyboard()
    );
  });
}

async function myTasks(ctx) {
  updateData(ctx);
  const tasks = await new Promise((resolve) => {
    setTimeout(() => {
      resolve(tasksList);
    }, 300);
  });
  let result = '';
  for (let i = 0; i < tasks.length; i++) {
    result += `${i + 1}. ${tasks[i]}\n`;
  }
  if (result === '') {
    ctx.replyWithHTML(
      '<b>Список ваших задач пуст</b>'
    );
  } else {
    ctx.replyWithHTML(
      '<b>Список ваших задач:</b>\n\n' +
      `${result}`
    );
  }
}

async function deleteTask(ctx) {
  updateData(ctx);
  await ctx.replyWithHTML(
    'Введите порядковый номер задачи, например <b> "5" </b>,чтобы удалить задачу 5'
  );
  bot.hears(/[0-9]/, async (ctx) => {
    taskId = Number(ctx.message.text) - 1;
    action = 'delete';
    await ctx.replyWithHTML(
      'Вы действительно хотите удалить задачу №' +
      `<i>${taskId + 1}</i>`,
      yesNoKeyboard()
    );
  });
}

function yesNoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Да', 'yes')],
    [Markup.button.callback('Нет', 'no')]
  ]);
}

bot.action(['yes', 'no'], async (ctx) => {
  await ctx.answerCbQuery();
  if (ctx.callbackQuery.data === 'yes' && action === 'add') {
    await tasksList.push(taskText);
    await users.updateOne(
      { chatId: String(ctx.chat.id) },
      {
        $set: {
          tasks: tasksList
        }
      }
    );
    await ctx.editMessageText('Ваша задача успешно добавлена');
  } else if (ctx.callbackQuery.data === 'yes' && action === 'delete') {
    tasksList.splice(taskId, 1);
    users.updateOne(
      { chatId: String(ctx.chat.id) },
      {
        $set: {
          tasks: tasksList
        }
      }
    );
    await ctx.editMessageText('Ваша задача успешно удалена');
  } else {
    await ctx.deleteMessage();
  }
});

bot.command('menu', async (ctx) => {
  await ctx.replyWithHTML('<b>Меню планировщика</b>', Markup.inlineKeyboard(
    [
      [Markup.button.callback('Мои задачи', 'btn_1')],
      [Markup.button.callback('Добавить задачу', 'btn_2')],
      [Markup.button.callback('Удалить задачу', 'btn_3')],
    ]
  ));
});

bot.launch();

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
