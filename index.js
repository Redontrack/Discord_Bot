require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  Events,
  SlashCommandBuilder,
  REST,
  Routes,
  ChannelType
} = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let regelnMessageId = null;

//////////////////////////////////////////////////
// Slash Command registrieren
//////////////////////////////////////////////////

const commands = [
  new SlashCommandBuilder()
    .setName("regeln")
    .setDescription("Sendet die Server Regeln")
    .toJSON()
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  await rest.put(
    Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
    { body: commands }
  );
})();

//////////////////////////////////////////////////
// Bot Ready
//////////////////////////////////////////////////

client.once("clientReady", async () => {
  console.log(`Bot ist online als ${client.user.tag}`);

  const guild = client.guilds.cache.get(GUILD_ID);
  const regelnChannel = guild.channels.cache.find(
    c => c.name === "regeln" && c.type === ChannelType.GuildText
  );

  if (!regelnChannel) return console.log("❌ #regeln Kanal nicht gefunden");

  // Gepinnte Nachrichten prüfen
  const pinned = await regelnChannel.messages.fetchPinned();
  if (pinned.size > 0) {
    regelnMessageId = pinned.first().id;
    console.log("✅ Regeln Nachricht gefunden");
  }
});

//////////////////////////////////////////////////
// Neue Mitglieder → nur #regeln sehen
//////////////////////////////////////////////////

client.on(Events.GuildMemberAdd, async member => {
  const guild = member.guild;

  const regelnChannel = guild.channels.cache.find(
    c => c.name === "regeln"
  );

  if (!regelnChannel) return;

  await regelnChannel.permissionOverwrites.edit(member, {
    ViewChannel: true,
    SendMessages: false,
    AddReactions: true
  });

  guild.channels.cache.forEach(async channel => {
    if (channel.id !== regelnChannel.id) {
      await channel.permissionOverwrites.edit(member, {
        ViewChannel: false
      });
    }
  });

  console.log(`${member.user.tag} auf #regeln beschränkt`);
});

//////////////////////////////////////////////////
// /regeln Command
//////////////////////////////////////////////////

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "regeln") return;

  const msg = await interaction.reply({
    content:
      "📜 **Server Regeln**\n \n1. Seit Korrekt zueinander \n2. Tut nichts was ich nicht aucht tun würde \n3. Keine Werbung \n4. Mods und Streamer haben immer Recht(nur auf die Regeln bezogen) \n\nReagiere mit ✅ um die Regeln zu akzeptieren.",
    fetchReply: true
  });

  await msg.react("✅");
  await msg.pin();

  regelnMessageId = msg.id;

  console.log("Regeln Nachricht erstellt & gepinnt");
});

//////////////////////////////////////////////////
// Reaktion → Rolle + Move
//////////////////////////////////////////////////

client.on(Events.MessageReactionAdd, async (reaction, user) => {
  if (user.bot) return;

  if (reaction.partial) await reaction.fetch();

  if (!regelnMessageId) return;
  if (reaction.message.id !== regelnMessageId) return;
  if (reaction.emoji.name !== "✅") return;

  const guild = reaction.message.guild;
  const member = await guild.members.fetch(user.id);

  const role = guild.roles.cache.find(r => r.name === "Member");
  const targetChannel = guild.channels.cache.find(
    c => c.name === "Stream Wartebereich"
  );

  if (!role) return console.log("❌ Rolle 'Member' fehlt");

  // Rolle geben
  if (!member.roles.cache.has(role.id)) {
    await member.roles.add(role);
    console.log(`${user.tag} hat Member Rolle bekommen`);
  }

  // Kanalrechte freigeben
  guild.channels.cache.forEach(async channel => {
    await channel.permissionOverwrites.edit(member, {
      ViewChannel: true
    });
  });

  // Move wenn User in Voice ist
  if (targetChannel && member.voice.channel) {
    await member.voice.setChannel(targetChannel);
    console.log(`${user.tag} verschoben`);
  }
});

client.login(TOKEN);
