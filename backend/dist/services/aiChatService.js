"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatWithAssistant = chatWithAssistant;
const generative_ai_1 = require("@google/generative-ai");
const mongoose_1 = __importDefault(require("mongoose"));
const Category_1 = require("../models/Category");
const ServiceOffer_1 = require("../models/ServiceOffer");
const Service_1 = require("../models/Service");
const ProviderProfile_1 = require("../models/ProviderProfile");
const providerPublicService_1 = require("./providerPublicService");
function normalize(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}
const STOP_WORDS = new Set([
    'dhe', 'per', 'nje', 'ne', 'te', 'me', 'po', 'jo', 'une', 'ti', 'ai', 'ajo',
    'neve', 'ju', 'ata', 'ato', 'kam', 'ke', 'ka', 'kemi', 'keni', 'kane',
    'jam', 'je', 'eshte', 'jemi', 'jeni', 'jane', 'nga', 'tek', 'ku', 'si',
    'cfare', 'pse', 'kur', 'sa', 'dua', 'duhet', 'kerkoj', 'ndihme', 'lutem',
    'the', 'and', 'for', 'with', 'in', 'on', 'at', 'a', 'an', 'is', 'are', 'to',
]);
function extractTokens(text) {
    return normalize(text)
        .split(/[^a-z0-9]+/i)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}
async function findRelevantPlatformData(userQuery) {
    if (mongoose_1.default.connection.readyState !== 1) {
        return [];
    }
    const tokens = extractTokens(userQuery);
    const results = [];
    const seenIds = new Set();
    try {
        // 1. Search Categories
        const categories = await Category_1.Category.find({ status: 'active', isActive: true })
            .select('_id name stableId slug labels keywords')
            .lean();
        const matchedCategories = categories.filter((cat) => {
            const sq = normalize(cat.name?.sq || cat.labels?.get?.('sq') || '');
            const en = normalize(cat.name?.en || cat.labels?.get?.('en') || '');
            const stable = normalize(cat.stableId || cat.slug || '');
            const kws = (cat.keywords || []).map(normalize);
            return tokens.some((token) => sq.includes(token) || en.includes(token) || stable.includes(token) || kws.some((k) => k.includes(token)));
        }).slice(0, 2);
        for (const cat of matchedCategories) {
            const label = cat.name?.sq || (cat.labels instanceof Map ? cat.labels.get('sq') : '') || cat.stableId;
            results.push({
                id: String(cat._id),
                type: 'category',
                title: label,
                subtitle: 'Kategori në KeshillaKos',
                url: `/ofertat?category=${cat.stableId || cat._id}`,
            });
            seenIds.add(String(cat._id));
        }
        // 2. Search Services / ServiceOffers
        const regexQueries = tokens.map((t) => new RegExp(t, 'i'));
        if (regexQueries.length > 0) {
            const offers = await ServiceOffer_1.ServiceOffer.find({
                status: 'published',
                visibility: 'public',
                'moderation.status': 'approved',
                $or: [
                    { name: { $in: regexQueries } },
                    { description: { $in: regexQueries } },
                ],
            })
                .populate('category', 'name stableId')
                .populate('providerProfile', 'publicProfile')
                .limit(4)
                .lean();
            for (const offer of offers) {
                const id = String(offer._id);
                if (seenIds.has(id))
                    continue;
                seenIds.add(id);
                const categoryLabel = offer.category?.name?.sq || 'Shërbim';
                const providerName = offer.providerProfile?.publicProfile?.displayName;
                results.push({
                    id,
                    type: 'service',
                    title: offer.name,
                    subtitle: providerName ? `Ofruar nga ${providerName}` : undefined,
                    category: categoryLabel,
                    price: offer.price?.amountFrom ?? offer.price?.amountTo,
                    url: `/services/${id}`,
                });
            }
            // Legacy services if offers were few
            if (results.length < 3) {
                const legacyServices = await Service_1.Service.find({
                    active: true,
                    $or: [
                        { title: { $in: regexQueries } },
                        { description: { $in: regexQueries } },
                        { subcategory: { $in: regexQueries } },
                    ],
                })
                    .limit(3)
                    .lean();
                for (const s of legacyServices) {
                    const id = String(s._id);
                    if (seenIds.has(id))
                        continue;
                    seenIds.add(id);
                    results.push({
                        id,
                        type: 'service',
                        title: s.title,
                        subtitle: s.providerName ? `Ofruar nga ${s.providerName}` : undefined,
                        category: s.categoryLabel || s.subcategory,
                        location: s.location,
                        price: s.priceFrom,
                        url: `/services/${id}`,
                    });
                }
            }
            // 3. Search Providers / Experts
            const profiles = await ProviderProfile_1.ProviderProfile.find({
                status: 'published',
                'moderation.status': 'approved',
                $or: [
                    { 'publicProfile.displayName': { $in: regexQueries } },
                    { 'publicProfile.title': { $in: regexQueries } },
                    { 'publicProfile.shortDescription': { $in: regexQueries } },
                    { 'publicProfile.description': { $in: regexQueries } },
                ],
            })
                .limit(3)
                .lean();
            const providerDetails = await (0, providerPublicService_1.getProvidersPublicDetails)(profiles.map((p) => String(p._id)), new Map(profiles.map((p) => [String(p._id), p.publicProfile?.displayName || 'Ekspert'])));
            for (const p of profiles) {
                const id = String(p._id);
                if (seenIds.has(id))
                    continue;
                seenIds.add(id);
                const details = providerDetails.get(id);
                results.push({
                    id,
                    type: 'expert',
                    title: p.publicProfile?.displayName || 'Ekspert i verifikuar',
                    subtitle: p.publicProfile?.title || p.publicProfile?.shortDescription,
                    rating: details?.ratingAverage,
                    ratingCount: details?.ratingCount,
                    url: `/providers/${p.ownerUser || id}`,
                });
            }
        }
    }
    catch (err) {
        console.warn('Error loading platform recommendations for AI chat:', err);
    }
    return results.slice(0, 5);
}
function buildSystemPrompt(contextData) {
    const recommendationsText = contextData.length > 0
        ? `Këtu janë disa shërbime/ekspertë realë nga platforma KeshillaKos që përputhen me kërkesën:
${JSON.stringify(contextData, null, 2)}
Përfshiji këto rekomandime në përgjigjen tënde në mënyrë natyrale dhe ftoje përdoruesin t'i shohë ato.`
        : 'Nuk u gjetën shërbime direkte me këtë emër ekzakt, por udhëzoje përdoruesin drejt kategorive kryesore si Ligj, Kontabilitet, Konsulencë, IT, ose dërgimit të një kërkese të hapur në /ofertat.';
    return `Ti je "Këshilla AI", asistenti zyrtar inteligjent i platformës KeshillaKos (KLAW) në Kosovë.

INFORMACION PËR KESHILLAKOS:
- KeshillaKos është platforma numër 1 në Kosovë dhe diasporë për lidhjen e qytetarëve dhe bizneseve me ekspertë të kualifikuar (avokatë, kontabilistë, noterë, konsulentë biznesi, përkthyes zyrtarë me vulë, inxhinierë, specialistë IT).
- Funksionet kryesore të platformës:
  1. Shfletimi i shërbimeve & ofertave të gatshme: /ofertat
  2. Dërgimi i kërkesave të personalizuara (Request/Offer Matching): Përdoruesi mund të dërgojë kërkesë me nevojën e vet dhe ekspertët i përgjigjen me oferta konkrete.
  3. Biseda dhe rezervimi i takimeve (online ose fizikisht).
  4. Planet e anëtarësimit për ofruesit: Standard dhe Pro (komision 0%, profil i verifikuar, ekspozim maksimal në platformë) në /planet.
  5. Regjistrimi si ofrues/kompani: në /register dhe më pas plotësimi i profilit profesional.

UDHËZIME PËR KOSOVËN:
- Kur përdoruesi pyet për regjistrim biznesi: Shpjego hapat në ARBK (Agjencia për Regjistrimin e Bizneseve në Kosovë - përgatitja e statutit/aktit themelues, certifikata e regjistrimit, regjistrimi në ATK për numër fiskal brenda 15 ditëve, hapja e llogarisë bankare).
- Kur përdoruesi pyet për taksa në Kosovë: Shpjego normat në ATK (Tatimi në të Ardhura të Korporatave 10%, TVSH 18% me normë të zbritur 8% për artikuj bazë, pragu i regjistrimit në TVSH 30,000€ qarkullim vjetor, TAP sipas shkallëve progresive, kontributi pensional 5% punëmarrësi + 5% punëdhënësi).
- Kur pyet për çështje ligjore/kontrata/prona: Shpjego rëndësinë e ligjit të Kosovës (p.sh. Ligji i Punës, nevoja e aktit noterial për paluajtshmëri pranë Noterit dhe regjistrimi në Kadastër).

RREGULLA TË PËRGJIGJES:
1. Gjuhë: Përgjigju gjithmonë në SHQIP (ose në gjuhën në të cilën shkruan përdoruesi nëse është anglisht apo gjermanisht).
2. Ton: Tejet profesional, i qartë, i ngrohtë, dashamirës dhe inkurajues.
3. Formati: Përdor Markdown të pasur (tituj të lexueshëm, lista me pika '•', theksim me **bold**).
4. Disclaimer ligjor: Nëse diskutohen çështje ligjore ose tatimore, gjithmonë vendos në fund:
   > ⚖️ *Kjo këshillë është vetëm informative dhe nuk zëvendëson konsulencën zyrtare nga një avokat ose kontabilist i licencuar në KeshillaKos.*
5. Veprime të sugjeruara: Zgjidh 2 deri në 4 butona/veprime të shpejta që përdoruesi mund të klikojë.

${recommendationsText}

FORMATI I PËRGJIGJES:
Kthe VETËM një JSON të vlefshëm me këtë strukturë ekzakte:
{
  "reply": "Përgjigja jote e detajuar me markdown...",
  "suggestedActions": ["Teksti i veprimit 1", "Teksti i veprimit 2", "Teksti i veprimit 3"]
}`;
}
function parseGeminiResponse(rawText) {
    try {
        const cleaned = rawText
            .replace(/```(?:json)?\s*/gi, '')
            .replace(/```\s*$/gi, '')
            .trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
            const parsed = JSON.parse(cleaned.slice(start, end + 1));
            if (parsed.reply && typeof parsed.reply === 'string') {
                return {
                    reply: parsed.reply,
                    suggestedActions: Array.isArray(parsed.suggestedActions)
                        ? parsed.suggestedActions.filter((s) => typeof s === 'string' && s.length < 50)
                        : [],
                };
            }
        }
    }
    catch (err) {
        console.warn('Could not parse Gemini JSON response, extracting text:', err);
    }
    // Fallback if raw text wasn't valid JSON
    const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
    return {
        reply: cleaned,
        suggestedActions: [
            'Shiko Ofertat në KeshillaKos',
            'Gjej një Ekspert',
            'Si të regjistroj një biznes?',
        ],
    };
}
function intelligentFallback(userQuery, matchedEntities) {
    const norm = normalize(userQuery);
    // 1. Business Registration
    if (/biznes|arbk|shpk|kompani|hapje|regjistr.*biznes/.test(norm)) {
        return {
            reply: `### 🏢 Si të regjistrosh një biznes në Kosovë (Sh.p.k.)

Regjistrimi i një biznesi në Kosovë bëhet pranë **ARBK** (Agjencia për Regjistrimin e Bizneseve në Kosovë) ose në Qendrat Komunale të Shërbimit (One-Stop-Shop):

1. **Përcaktimi i Emrit dhe Formës Juridike**:
   • Forma më e zakonshme është **Shoqëri me Përgjegjësi të Kufizuar (Sh.p.k.)**.
   • Nuk kërkohet kapital minimal fillestar për themelim.

2. **Dokumentacioni i Nevojshëm**:
   • Kopje e letërnjoftimit/pasaportës së pronarit (apo themeluesve).
   • Marrëveshja e themelimit dhe statuti i shoqërisë.
   • Kontrata e qirasë apo dëshmia e pronësisë për selinë e biznesit.
   • Formulari i plotësuar i aplikimit për ARBK.

3. **Hapat Pas Certifikatës së Biznesit**:
   • **Numri Fiskal**: Regjistrimi në Administratën Tatimore të Kosovës (ATK) brenda 15 ditëve.
   • **Llogaria Bankare**: Hapja e llogarisë bankare të biznesit në një nga bankat komerciale në Kosovë.
   • **Pajisja me Arkë Fiskale**: Nëse biznesi kryen shitje me para në dorë.

> ⚖️ *Kjo këshillë është vetëm informative. Për përgatitjen e statuteve dhe kontratave, rekomandohet asistenca e një avokati ose kontabilisti në KeshillaKos.*`,
            suggestedActions: [
                'Konsulto Kontabilist për Biznes',
                'Gjej Avokat për Statutin',
                'Eksploro Shërbimet në KeshillaKos',
            ],
            recommendedEntities: matchedEntities,
        };
    }
    // 2. Taxes and Accounting
    if (/taks|atk|tatim|kontabil|fature|tvsh|bilanc|paga/.test(norm)) {
        return {
            reply: `### 📊 Sistemi Tatimor dhe Kontabiliteti në Kosovë (ATK)

Në Kosovë, sistemi tatimor administrohet nga **Administrata Tatimore e Kosovës (ATK)**:

• **Tatimi mbi Vlerën e Shtuar (TVSH)**:
  - Norma standarde është **18%**.
  - Norma e zbritur është **8%** (për furnizime bazike si uji, mielli, vaji, librat, transporti publik etj.).
  - Pragu ligjor i detyrueshëm për regjistrim në TVSH është **30,000 €** qarkullim vjetor.

• **Tatimi në të Ardhura të Korporatave (TAK)**:
  - Norma fikse është **10%** mbi fitimin e tatueshëm vjetor.

• **Kontributet Pensionale**:
  - Gjithsej **10%** nga paga bruto (5% ndalet nga punëmarrësi, 5% paguhet nga punëdhënësi).

• **Deklarimet Mujore**:
  - Dorëzohen elektronikisht përmes platformës EDI të ATK-së deri më datën 15 të çdo muaji.

Për të mbajtur librat financiarë dhe për të shmangur gjobat nga ATK, ju sugjerojmë të punoni me një nga kontabilistët tanë të verifikuar!`,
            suggestedActions: [
                'Shiko Ekspertët e Kontabilitetit',
                'Llogarit Taksat me një Ekspert',
                'Dërgo Kërkesë për Ofertë',
            ],
            recommendedEntities: matchedEntities,
        };
    }
    // 3. Legal & Contracts
    if (/avokat|ligj|kontrat|gjyk|padi|prone|kadast|noter|shkurorezim|trashegimi/.test(norm)) {
        return {
            reply: `### ⚖️ Shërbime Ligjore dhe Kontrata në Kosovë

Në platformën **KeshillaKos**, mund të gjeni avokatë të licencuar nga Oda e Avokatëve të Kosovës (OAK) dhe ekspertë ligjorë për:

• **Hartim dhe Rishikim Kontratash**:
  - Kontrata pune në përputhje me Ligjin e Punës në Kosovë (Nr. 03/L-212).
  - Kontrata të qirasë, shërbimeve tregtare dhe bashkëpunimit mes kompanive.

• **Çështje Pronësore dhe Kadastrale**:
  - Verifikimi i titujve të pronësisë në Agjencinë Kadastrale të Kosovës.
  - Procedurat e shitblerjes së paluajtshmërive që kërkojnë akt noterial.

• **Përfaqësim në Gjykatë dhe Çështje Familjare**:
  - Çështje civile, trashëgimore dhe konteste pune.

> ⚖️ *Kjo këshillë është vetëm informative dhe nuk zëvendëson konsulencën zyrtare nga një avokat i licencuar në KeshillaKos.*`,
            suggestedActions: [
                'Gjej Avokat të Licencuar',
                'Shërbime të Noterisë',
                'Krijo Kërkesë të Personalizuar',
            ],
            recommendedEntities: matchedEntities,
        };
    }
    // 4. Platform info and Pricing
    if (/plan|cmim|kushton|abono|pro|standard|pages/.test(norm)) {
        return {
            reply: `### 💳 Planet dhe Çmimet në KeshillaKos

Platforma **KeshillaKos** është falas për klientët që kërkojnë shërbime, ndërsa për ekspertët dhe kompanitë ofron plane transparente me përfitime maksimale:

• **Për Klientët (Individë dhe Biznese)**:
  - Shfletimi i shërbimeve, dërgimi i kërkesave dhe biseda me ekspertët janë **falas**.

• **Për Ofruesit e Shërbimeve (Planet e Anëtarësimit)**:
  - **Plani Standard**: Publikim i profilit bazë, pranim i kërkesave dhe bisedë e drejtpërdrejtë me klientët.
  - **Plani Pro**: **0% komision mbi pagesat**, distinktiv "I Verifikuar", renditje prioritare në kërkim, mbështetje prioritare dhe mundësi për shërbime të pakufizuara.

Vizitoni faqen tonë të planeve për të parë detajet e plota!`,
            suggestedActions: [
                'Shiko Detajet e Planeve',
                'Regjistrohu si Ekspert',
                'Eksploro Shërbimet',
            ],
            recommendedEntities: matchedEntities,
        };
    }
    // 5. General Greeting
    if (/pershendetje|ckemi|tung|mirdita|hello|hi|mirëmbrëma/.test(norm) || norm.length < 5) {
        return {
            reply: `### 👋 Përshëndetje! Jam Këshilla AI

Jam asistenti juaj inteligjent në **KeshillaKos**. Jam këtu për t'ju ndihmuar të gjeni shërbimin ose ekspertin e duhur, si dhe për t'ju dhënë përgjigje të shpejta për:

• **Ligj dhe Kontrata**: Avokatë të licencuar, noterizim, kontrata pune e biznesi.
• **Biznes dhe ARBK**: Hapat për hapjen e një biznesi në Kosovë, statutet dhe procedurat.
• **Taksa dhe ATK**: TVSH, tatimi në korporata, kontabiliteti dhe deklarimet mujore.
• **Përkthime Zyrtare, IT & Arkitekturë**: Shërbime profesionale nga ekspertë të verifikuar.

Për çfarë keni nevojë konkretisht sot? Mund të më bëni çdo pyetje ose të zgjidhni një nga opsionet më poshtë!`,
            suggestedActions: [
                'Si të hap një biznes në Kosovë?',
                'Më duhet një Avokat në Prishtinë',
                'Këshilla për Taksat dhe ATK',
                'Eksploro Shërbimet në Ofertat',
            ],
            recommendedEntities: matchedEntities,
        };
    }
    // 6. Generic query with recommendations
    return {
        reply: `### 💡 Informacion për kërkesën tuaj

Faleminderit për pyetjen! Në **KeshillaKos** mund të gjeni profesionistë të kualifikuar që mund t'ju ndihmojnë pikërisht për këtë fushë.

${matchedEntities.length > 0 ? 'Më poshtë keni disa rekomandime direkte nga platforma:' : 'Mund të kërkoni direkt në katalogun tonë të shërbimeve ose të postoni një kërkesë të personalizuar që ekspertët t\'ju kontaktojnë me oferta.'}

Nëse dëshironi këshilla më të detajuara, më tregoni pak më shumë rreth rastit tuaj (p.sh. qyteti, natyra e punës ose afati)!`,
        suggestedActions: [
            'Shiko të Gjitha Shërbimet',
            'Dërgo Kërkesë të Hapur',
            'Kontakto Mbështetjen',
        ],
        recommendedEntities: matchedEntities,
    };
}
async function chatWithAssistant(messages, context) {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
    const matchedEntities = await findRelevantPlatformData(lastUserMessage);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        return intelligentFallback(lastUserMessage, matchedEntities);
    }
    try {
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.4,
                maxOutputTokens: 1024,
            },
        });
        const systemPrompt = buildSystemPrompt(matchedEntities);
        // Build chat contents for Gemini
        const contents = [];
        // Inject system instructions as the opening exchange
        contents.push({
            role: 'user',
            parts: [{ text: `[SYSTEM INSTRUCTION]\n${systemPrompt}\n\nKonfirmo që e kuptove rolin tënd.` }],
        });
        contents.push({
            role: 'model',
            parts: [{ text: 'E kuptova plotësisht. Jam Këshilla AI, asistenti zyrtar i KeshillaKos. Do të përgjigjem në formatin JSON të kërkuar me markdown të pasur, sugjerime veprimesh dhe këshilla të sakta për Kosovën.' }],
        });
        // Add recent conversation history (up to last 6 messages)
        const recentMessages = messages.slice(-6);
        for (const msg of recentMessages) {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }],
            });
        }
        // Add context note to the last user message if available
        if (context?.pathname || context?.location) {
            const extraContext = `[Konteksti i faqes aktuale: ${context.pathname || '/'}; Lokacioni: ${context.location || 'Kosovë'}]`;
            const lastIndex = contents.length - 1;
            if (lastIndex >= 0 && contents[lastIndex].role === 'user') {
                contents[lastIndex].parts[0].text += `\n\n${extraContext}`;
            }
        }
        const result = await model.generateContent({ contents });
        const textResponse = result.response.text();
        const parsed = parseGeminiResponse(textResponse);
        return {
            reply: parsed.reply,
            suggestedActions: parsed.suggestedActions.length > 0
                ? parsed.suggestedActions
                : ['Eksploro Shërbimet', 'Gjej një Avokat', 'Krijo Kërkesë'],
            recommendedEntities: matchedEntities,
        };
    }
    catch (err) {
        console.warn('Gemini chat request failed, using intelligent fallback engine:', err);
        return intelligentFallback(lastUserMessage, matchedEntities);
    }
}
//# sourceMappingURL=aiChatService.js.map