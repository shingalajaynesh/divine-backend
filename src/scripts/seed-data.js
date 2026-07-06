import dotenv from 'dotenv';
import { initializeDataModels } from '../config/db-init.js';
import Logger from '../util/logger.js';

dotenv.config();

const log = new Logger('SeedData');

const runSeed = async () => {
  log.info('Connecting to PostgreSQL database to seed all 280 days of content...');

  try {
    const dataModels = initializeDataModels(log);
    const { DailyContent, BabyDevelopment, LiveClass, QuizQuestion, PartnerActivity, SensoryActivity } = dataModels.models;

    // Clear existing tables
    log.info('Clearing old calendar, milestones, and daily activity logs...');
    await DailyContent.destroy({ where: {}, force: true });
    await BabyDevelopment.destroy({ where: {}, force: true });
    await QuizQuestion.destroy({ where: {}, force: true });
    await PartnerActivity.destroy({ where: {}, force: true });
    await SensoryActivity.destroy({ where: {}, force: true });

    // 1. Seed 280-day content calendar
    log.info('Generating 280 days of content items...');
    const categories = ['story', 'yoga', 'mantra', 'affirmation', 'recipe', 'meditation'];
    const dailyContentsToCreate = [];
    
    for (let i = 1; i <= 280; i++) {
      const cat = categories[i % categories.length];
      dailyContentsToCreate.push({
        dayNumber: i,
        category: cat,
        titleEn: `Day ${i}: Daily Inspiration (${cat.toUpperCase()})`,
        titleHi: `दिन ${i}: दैनिक प्रेरणा (${cat.toUpperCase()})`,
        bodyEn: `Focus today on mindfulness, peace, and health for pregnancy week ${Math.ceil(i / 7)}, day ${i}. Keep your mind calm and positive.`,
        bodyHi: `गर्भावस्था सप्ताह ${Math.ceil(i / 7)}, दिन ${i} के लिए सचेत रहने, शांति और स्वास्थ्य पर ध्यान केंद्रित करें। अपने मन को शांत रखें।`,
        mediaUrl: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-${(i % 10) + 1}.mp3`
      });
    }
    await DailyContent.bulkCreate(dailyContentsToCreate);
    log.info('✅ 280 content items seeded.');

    // 2. Seed Weekly Baby Milestones (1 to 40)
    log.info('Generating 40 weeks of baby milestones...');
    const sizesEn = ['poppy seed', 'apple seed', 'sweet pea', 'ripe lime', 'small apple', 'juicy pear', 'ear of corn', 'sweet coconut', 'sweet watermelon'];
    const sizesHi = ['खसखस का बीज', 'सेब का बीज', 'मीठी मटर', 'पका नींबू', 'छोटा सेब', 'रसीला नाशपाती', 'मक्के का भुट्टा', 'मीठा नारियल', 'मीठा तरबूज'];
    const milestonesToCreate = [];

    for (let w = 1; w <= 40; w++) {
      const idx = w % sizesEn.length;
      milestonesToCreate.push({
        weekNumber: w,
        sizeEn: `A ${sizesEn[idx]}`,
        sizeHi: `एक ${sizesHi[idx]}`,
        weight: `${Math.round(w * 85)}g`,
        milestoneEn: `Baby's organ growth, muscles, and nerves continue to mature for week ${w}. Movement awareness is active.`,
        milestoneHi: `बच्चे के अंगों की वृद्धि, मांसपेशियां और नसें सप्ताह ${w} के लिए परिपक्व होती रहती हैं।`
      });
    }
    await BabyDevelopment.bulkCreate(milestonesToCreate);
    log.info('✅ 40 weekly milestones seeded.');

    // 3. Seed Scheduled Live Classes
    log.info('Seeding live classes...');
    const classes = [
      {
        titleEn: 'Prenatal Meditative Yoga & Deep Breathing',
        titleHi: 'प्रसव पूर्व ध्यान योग और गहरी साँस लेना',
        instructor: 'Mrs. Priya Patel',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
        durationMins: 45,
        videoCallUrl: 'https://meet.jit.si/DivineGarbhSanskarYoga'
      },
      {
        titleEn: 'Weekly Garbh Samvad & Talking to Your Baby',
        titleHi: 'साप्ताहिक गर्भ संवाद और अपने बच्चे से बात करना',
        instructor: 'Dr. Sunita Sharma',
        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // In 2 days
        durationMins: 60,
        videoCallUrl: 'https://meet.jit.si/DivineGarbhSanskarMeditation'
      }
    ];
    for (const cls of classes) {
      await LiveClass.findOrCreate({
        where: { titleEn: cls.titleEn },
        defaults: cls
      });
    }
    log.info('✅ Live workshops seeded.');

    // 4. Seed Daily Quiz Questions (1 to 280)
    log.info('Generating 280 daily quiz questions...');
    const quizzesToCreate = [];
    for (let i = 1; i <= 280; i++) {
      quizzesToCreate.push({
        dayNumber: i,
        questionTextEn: `Recommended healthy practice for pregnancy day ${i}?`,
        questionTextHi: `गर्भावस्था दिन ${i} के लिए अनुशंसित स्वास्थ्य अभ्यास क्या है?`,
        optionsEn: ['Gentle rest and meditation', 'Heavy running', 'Eating high sugar foods', 'Staying awake late'],
        optionsHi: ['कोमल आराम और ध्यान', 'भारी दौड़', 'अधिक चीनी वाला भोजन करना', 'देर तक जागना'],
        correctOptionIndex: 0,
        explanationEn: 'Gentle meditation and mindfulness keep your blood pressure stable and help you connect with your baby.',
        explanationHi: 'कोमल ध्यान और सचेत होना आपके रक्तचाप को स्थिर रखता है और आपको अपने बच्चे से जुड़ने में मदद करता है।'
      });
    }
    await QuizQuestion.bulkCreate(quizzesToCreate);
    log.info('✅ 280 daily quizzes seeded.');

    // 5. Seed Partner Activities (1 to 280)
    log.info('Generating 280 daily partner activities...');
    const partnerActivitiesToCreate = [];
    for (let i = 1; i <= 280; i++) {
      partnerActivitiesToCreate.push({
        dayNumber: i,
        titleEn: `Partner Connection: Day ${i}`,
        titleHi: `साथी संबंध: दिन ${i}`,
        descriptionEn: `Spend 10 minutes discussing your plans, reading a story together, or connecting with the baby on day ${i}`,
        descriptionHi: `दिन ${i} पर अपनी योजनाओं पर चर्चा करने, एक साथ कहानी पढ़ने, या बच्चे से जुड़ने में 10 मिनट बिताएं`
      });
    }
    await PartnerActivity.bulkCreate(partnerActivitiesToCreate);
    log.info('✅ 280 daily partner activities seeded.');

    // 6. Seed Sensory Activities (1 to 280)
    log.info('Generating 280 daily sensory activities...');
    const senseTypes = ['TOUCH', 'HEARING', 'VISION', 'TASTE', 'SMELL'];
    const sensoryActivitiesToCreate = [];
    for (let i = 1; i <= 280; i++) {
      const st = senseTypes[i % senseTypes.length];
      sensoryActivitiesToCreate.push({
        dayNumber: i,
        senseType: st,
        titleEn: `Sensory Practice (${st}): Day ${i}`,
        titleHi: `इंद्रिय अभ्यास (${st}): दिन ${i}`,
        descriptionEn: `Engage your senses through gentle sounds, colors, healthy tastes, or comforting touch on day ${i}.`,
        descriptionHi: `आज दिन ${i} पर सौम्य ध्वनियों, रंगों, स्वस्थ स्वादों, या आरामदायक स्पर्श के माध्यम से अपनी इंद्रियों को शामिल करें।`
      });
    }
    await SensoryActivity.bulkCreate(sensoryActivitiesToCreate);
    log.info('✅ 280 daily sensory activities seeded.');

    log.info('✅ Seeding complete successfully.');
    process.exit(0);
  } catch (error) {
    log.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

runSeed();
