import dotenv from 'dotenv';
import { initializeDataModels } from '../config/db-init.js';
import Logger from '../util/logger.js';

dotenv.config();

const log = new Logger('SeedData');

const runSeed = async () => {
  log.info('Connecting to PostgreSQL database to seed initial content...');

  try {
    const dataModels = initializeDataModels(log);

    const { DailyContent, BabyDevelopment, LiveClass, QuizQuestion, PartnerActivity, SensoryActivity } = dataModels.models;

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

    // 4. Seed Daily Quiz Questions
    log.info('Seeding daily quiz questions...');
    const quizzes = [
      {
        dayNumber: 1,
        questionTextEn: 'Which of the following is considered the best time to connect with your baby via Garbh Samvad?',
        questionTextHi: 'गर्भ संवाद के माध्यम से अपने बच्चे से जुड़ने का सबसे अच्छा समय कौन सा माना जाता है?',
        optionsEn: ['Early morning during peace', 'While watching busy action movies', 'When you are stressed', 'During heavy housework'],
        optionsHi: ['सुबह की शांति के दौरान', 'व्यस्त एक्शन फिल्में देखते समय', 'जब आप तनावग्रस्त हों', 'भारी घरेलू काम के दौरान'],
        correctOptionIndex: 0,
        explanationEn: 'Peaceful morning time allows you to focus and communicate with your baby with a calm and receptive mind.',
        explanationHi: 'शांतिपूर्ण सुबह का समय आपको शांत और ग्रहणशील दिमाग के साथ अपने बच्चे पर ध्यान केंद्रित करने और संवाद करने की अनुमति देता है।'
      },
      {
        dayNumber: 168,
        questionTextEn: "What is Prince Abhimanyu's story in the Mahabharata primarily known for in Garbh Sanskar?",
        questionTextHi: 'गर्भ संस्कार में महाभारत की राजकुमार अभिमन्यु की कहानी मुख्य रूप से किसके लिए जानी जाती है?',
        optionsEn: ['Learning from the womb', 'Defeating his father', 'Becoming a great doctor', 'Traveling to distant lands'],
        optionsHi: ['गर्भ से सीखना', 'अपने पिता को हराना', 'एक महान चिकित्सक बनना', 'दूर देशों की यात्रा करना'],
        correctOptionIndex: 0,
        explanationEn: "Prince Abhimanyu learned the art of entering the Chakravyuha from his mother's womb while Lord Krishna narrated the strategy.",
        explanationHi: 'भगवान कृष्ण द्वारा रणनीति सुनाने के दौरान राजकुमार अभिमन्यु ने अपनी माता के गर्भ से चक्रव्यूह में प्रवेश करने की कला सीखी थी।'
      }
    ];

    for (const q of quizzes) {
      await QuizQuestion.findOrCreate({
        where: { dayNumber: q.dayNumber },
        defaults: q
      });
    }
    log.info('✅ Daily quiz questions seeded.');

    // 5. Seed Partner Activities
    log.info('Seeding daily partner activities...');
    const partnerActivities = [
      {
        dayNumber: 1,
        titleEn: 'Pregnancy Confirmation & Partner Dialogue',
        titleHi: 'गर्भावस्था की पुष्टि और साथी संवाद',
        descriptionEn: 'Spend 10 minutes discussing your feelings, hopes, and setting a shared vision for this pregnancy journey together.',
        descriptionHi: 'अपनी भावनाओं, आशाओं पर चर्चा करने और एक साथ इस गर्भावस्था यात्रा के लिए एक साझा दृष्टिकोण निर्धारित करने में 10 मिनट बिताएं।'
      },
      {
        dayNumber: 168,
        titleEn: 'Husband/Partner Belly Massage and Connection',
        titleHi: 'पति/साथी पेट की मालिश और संबंध',
        descriptionEn: "Partner should gently apply moisturizer to mother's belly, speak loving words directly to the womb, and connect with the baby.",
        descriptionHi: 'साथी को धीरे से माँ के पेट पर मॉइस्चराइज़र लगाना चाहिए, सीधे गर्भ से प्यार भरे शब्द बोलने चाहिए और बच्चे से जुड़ना चाहिए।'
      }
    ];

    for (const pa of partnerActivities) {
      await PartnerActivity.findOrCreate({
        where: { dayNumber: pa.dayNumber },
        defaults: pa
      });
    }
    log.info('✅ Daily partner activities seeded.');

    // 6. Seed Sensory Activities
    log.info('Seeding daily sensory activities...');
    const sensoryActivities = [
      {
        dayNumber: 1,
        senseType: 'TOUCH',
        titleEn: 'Sensory Touch: Gentle Womb Connection',
        titleHi: 'सेंसरी टच: कोमल गर्भ संबंध',
        descriptionEn: 'Spend 5 minutes placing your palms flat on your lower abdomen, breathing deeply, and sending warmth and comfort to your womb.',
        descriptionHi: 'अपने निचले पेट पर अपनी हथेलियों को सपाट रखने, गहरी सांस लेने और अपने गर्भ में गर्माहट और आराम भेजने में 5 मिनट बिताएं।'
      },
      {
        dayNumber: 168,
        senseType: 'HEARING',
        titleEn: 'Sensory Hearing: Soft Nature Soundscape',
        titleHi: 'सेंसरी हियरिंग: कोमल प्राकृतिक ध्वनियाँ',
        descriptionEn: 'Listen to gentle forest stream or birdsong recordings for 10 minutes, focusing completely on the texture of each sound.',
        descriptionHi: '10 मिनट के लिए जंगल के कोमल झरने या पक्षियों की चहचहाहट की रिकॉर्डिंग सुनें, प्रत्येक ध्वनि की बनावट पर पूरी तरह ध्यान केंद्रित करें।'
      }
    ];

    for (const sa of sensoryActivities) {
      await SensoryActivity.findOrCreate({
        where: { dayNumber: sa.dayNumber },
        defaults: sa
      });
    }
    log.info('✅ Daily sensory activities seeded.');

    log.info('✅ Seeding complete.');
    process.exit(0);
  } catch (error) {
    log.error('❌ Database seeding failed:', error);
    process.exit(1);
  }
};

runSeed();
