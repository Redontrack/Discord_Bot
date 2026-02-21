require("dotenv").config();
const { 
    Client, 
    GatewayIntentBits, 
    Partials, 
    Events, 
    REST, 
    Routes, 
    SlashCommandBuilder 
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction]
});

const TOKEN = process.env.TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const GUILD_ID = process.env.GUILD_ID;

let regelnMessageId;

// ===== Slash Command /regeln =====
const commands = [
    new SlashCommandBuilder()
        .setName("regeln")
        .setDescription("Zeigt die Server Regeln an")
        .toJSON()
];

const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
    try {
        console.log("Slash Commands werden registriert...");
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands }
        );
        console.log("Slash Commands registriert ✅");
    } catch (err) {
        console.error(err);
    }
})();

// ===== Bot ready =====
client.once("ready", () => {
    console.log(`Bot ist online als ${client.user.tag}`);
});

// ===== Neue Mitglieder =====
client.on(Events.GuildMemberAdd, async member => {
    const guild = member.guild;
    const everyoneRole = guild.roles.everyone;

    // Rechte für neue User: nur #regeln sehen
    const regelnChannel = guild.channels.cache.find(c => c.name === "regeln" && c.type === 0); // 0 = Text
    if (!regelnChannel) return console.log("Kanal #regeln nicht gefunden!");

    // Setze alle Überschreibungen zurück
    await regelnChannel.permissionOverwrites.edit(member, {
        VIEW_CHANNEL: true,
        SEND_MESSAGES: false,
        ADD_REACTIONS: true
    });

    // Optional: alle anderen Kanäle unsichtbar
    guild.channels.cache.forEach(async channel => {
        if (channel.id !== regelnChannel.id) {
            await channel.permissionOverwrites.edit(member, {
                VIEW_CHANNEL: false
            });
        }
    });

    console.log(`${member.user.tag} nur auf #regeln beschränkt`);
});

// ===== Slash Command ausführen =====
client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName !== "regeln") return;

    const msg = await interaction.reply({
        content: "📜 **Server Regeln**\n\n1. Kein Spam\n2. Respektvoll bleiben\n3. Keine Werbung\n\nReagiere mit ✅ um die Regeln zu akzeptieren.",
        fetchReply: true
    });

    regelnMessageId = msg.id;

    // Reaktion hinzufügen
    await msg.react("✅");

    // Pin nur, wenn noch nicht gepinnt
    if (!msg.pinned) {
        try {
            await msg.pin();
            console.log("Regel-Nachricht wurde gepinnt ✅");
        } catch (err) {
            console.error("Nachricht konnte nicht gepinnt werden:", err);
        }
    } else {
        console.log("Nachricht ist bereits gepinnt");
    }
});

// ===== Reaktionen Handler =====
client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.id !== regelnMessageId) return;

    if (reaction.emoji.name === "✅") {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.find(r => r.name === "Member");
        const voiceChannel = guild.channels.cache.find(c => c.name === "Stream Wartebereich" && c.type === 2);

        if (!role) return console.log("Rolle 'Member' existiert nicht!");
        await member.roles.add(role);
        console.log(`${user.tag} hat die Member Rolle bekommen.`);

        // Zugriff auf alle Kanäle wieder freigeben
        guild.channels.cache.forEach(async channel => {
            await channel.permissionOverwrites.edit(member, {
                VIEW_CHANNEL: true
            });
        });

        // Mitglied verschieben, wenn im Voice
        if (voiceChannel && member.voice.channel) {
            await member.voice.setChannel(voiceChannel);
        }
    }
});

client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.id !== regelnMessageId) return;

    if (reaction.emoji.name === "✅") {
        const guild = reaction.message.guild;
        const member = await guild.members.fetch(user.id);
        const role = guild.roles.cache.find(r => r.name === "Member");
        if (!role) return;
        await member.roles.remove(role);
        console.log(`${user.tag} hat die Member Rolle entfernt.`);
    }
});

client.login(TOKEN);