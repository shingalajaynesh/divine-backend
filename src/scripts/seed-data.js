import dotenv from 'dotenv';
import { DataModels } from 'divine-data-models';
import Logger from '../util/logger.js';

dotenv.config();

const log = new Logger('SeedData');

const runSeed = async () => {
  log.info('Connecting to PostgreSQL database to seed initial content...');

  const dataModels = new DataModels(log);
  
  try {
    const useSSL = process.env.DB_SSL === 'true';
    dataModels.init({
      database: process.env.DB_NAME || 'divine_garbh_sanskar',
      dbUser: process.env.DB_USER || 'postgres',
      dbPassword: process.env.DB_PASSWORD || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      dialect: 'postgres',
      dialectOptions: useSSL ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      } : {}
    });

    const { DailyContent, BabyDevelopment, LiveClass } = dataModels.models;

    // 1. Seed 280-day content calendar samples
    log.info('Seeding 280-day content calendar items...');
    const contents = [
      {
        dayNumber: 1,
        category: 'story',
        titleEn: 'Day 1: Welcome to Your Sacred Journey',
        titleHi: 'दिन 1: आपकी पवित्र यात्रा में आपका स्वागत है',
        bodyEn: 'Congratulations on taking this first step towards conscious parenting. Focus today on quiet breathing and setting a positive intention for your baby.',
        bodyHi: 'सचेत पेरेंटिंग की ओर पहला कदम उठाने के लिए बधाई। आज शांत सांस लेने और अपने बच्चे के लिए सकारात्मक इरादा स्थापित करने पर ध्यान दें।',
        mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
      },
      {
        dayNumber: 168, // Week 24, Day 168
        category: 'story',
        titleEn: 'Day 168: The Courage of Prince Abhimanyu',
        titleHi: 'दिन 168: राजकुमार अभिमन्यु का साहस',
        bodyEn: 'Today, read aloud this historic story of Prince Abhimanyu who learned values of courage while in the womb. Imagine your child listening and absorbing these brave characters.',
        bodyHi: 'आज, गर्भ में रहते हुए साहस के मूल्यों को सीखने वाले राजकुमार अभिमन्यु की इस ऐतिहासिक कहानी को जोर से पढ़ें। कल्पना कीजिए कि आपका बच्चा इन बहादुर पात्रों को सुन और समझ रहा है।',
        mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3'
      },
      {
        dayNumber: 169, // Week 25, Day 169
        category: 'yoga',
        titleEn: 'Day 169: Pelvic Stretching Yoga Rites',
        titleHi: 'दिन 169: पेल्विक स्ट्रेचिंग योग रस्में',
        bodyEn: 'Practice gentle butterfly stretches and deep squat breathing. Sit comfortably, keep your back straight, and sync your movement with inhalation and exhalation.',
        bodyHi: 'सौम्य तितली खिंचाव और गहरे स्क्वाट श्वास का अभ्यास करें। आराम से बैठें, अपनी पीठ सीधी रखें, और अपने आंदोलन को सांस लेने और छोड़ने के साथ सिंक करें।',
        mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
      },
      {
        dayNumber: 280,
        category: 'mantra',
        titleEn: 'Day 280: Gayatri Mantra for Safe Delivery',
        titleHi: 'दिन 280: सुरक्षित प्रसव के लिए गायत्री मंत्र',
        bodyEn: 'Recite or listen to the sacred Gayatri Mantra. Focus on positive energy flow, safety, and a calm, peaceful mind.',
        bodyHi: 'पवित्र गायत्री मंत्र का पाठ करें या सुनें। सकारात्मक ऊर्जा प्रवाह, सुरक्षा और शांत, शांतिपूर्ण मन पर ध्यान केंद्रित करें।',
        mediaUrl: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3'
      }
    ];

    for (const c of contents) {
      await DailyContent.findOrCreate({
        where: { dayNumber: c.dayNumber },
        defaults: c
      });
    }
    log.info('✅ Content calendar items seeded.');

    // 2. Seed Weekly Baby Milestones (1 to 40)
    log.info('Seeding weekly baby growth milestones...');
    const milestones = [
      {
        weekNumber: 1,
        sizeEn: 'A tiny poppy seed',
        sizeHi: 'खसखस का एक छोटा बीज',
        weight: '0.1g',
        milestoneEn: 'Fertilization takes place. The zygote travels down the fallopian tube toward the uterus, dividing cells rapidly.',
        milestoneHi: 'निषेचन होता है। युग्मनज गर्भाशय की ओर फैलोपियन ट्यूब से नीचे यात्रा करता है, कोशिकाओं को तेजी से विभाजित करता है।'
      },
      {
        weekNumber: 12,
        sizeEn: 'A ripe lime',
        sizeHi: 'एक पका हुआ नींबू',
        weight: '14g',
        milestoneEn: 'Baby\'s organs, muscles, and nerves are starting to function. Reflexes are developing, and fingernails are appearing.',
        milestoneHi: 'बच्चे के अंग, मांसपेशियां और नसें काम करना शुरू कर रही हैं। रिफ्लेक्सिस विकसित हो रहे हैं, और उंगलियों के नाखून दिखाई दे रहे हैं।'
      },
      {
        weekNumber: 24,
        sizeEn: 'An ear of corn',
        sizeHi: 'मक्के का एक भुट्टा',
        weight: '600g',
        milestoneEn: 'Baby is starting to open eyes and hear external sounds. The inner ear is fully formed, enabling balance and movement awareness.',
        milestoneHi: 'बच्चा आँखें खोलना और बाहरी आवाज़ें सुनना शुरू कर रहा है। आंतरिक कान पूरी तरह से बनता है, जिससे संतुलन और आंदोलन जागरूकता सक्षम होती है।'
      },
      {
        weekNumber: 40,
        sizeEn: 'A sweet watermelon',
        sizeHi: 'एक मीठा तरबूज',
        weight: '3.4kg',
        milestoneEn: 'Your baby is fully grown and ready to meet you! All organs are fully functioning and fat stores are set for life outside.',
        milestoneHi: 'आपका बच्चा पूरी तरह से बड़ा हो गया है और आपसे मिलने के लिए तैयार है! सभी अंग पूरी तरह से काम कर रहे हैं।'
      }
    ];

    for (const m of milestones) {
      await BabyDevelopment.findOrCreate({
        where: { weekNumber: m.weekNumber },
        defaults: m
      });
    }
    log.info('✅ Weekly milestones seeded.');

    // 3. Seed Scheduled Live Classes
    log.info('Seeding scheduled live workshops...');
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

    log.info('✅ Seeding complete.');
    process.exit(0);
  } catch (error) {
    log.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

runSeed();
