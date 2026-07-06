const seedItems = [
  {
    category: 'mindfulness', slug: 'five-comfortable-breaths', contentType: 'meditation', visibility: 'free', sortOrder: 1,
    translations: [
      { language: 'en', title: 'Five comfortable breaths', summary: 'A gentle pause for mother and baby.', body: 'Sit in a supported position and breathe naturally five times. Do not hold or force your breath. Stop if you feel uncomfortable.' },
      { language: 'hi', title: 'पाँच सहज श्वास', summary: 'माँ और शिशु के लिए एक शांत विराम।', body: 'सहारे के साथ आराम से बैठें और पाँच बार स्वाभाविक रूप से श्वास लें। श्वास को रोकें या ज़ोर न दें। असुविधा होने पर रुक जाएँ।' },
      { language: 'gu', title: 'પાંચ સહજ શ્વાસ', summary: 'માતા અને બાળક માટે એક શાંત વિરામ.', body: 'ટેકો લઈને આરામથી બેસો અને પાંચ વખત સ્વાભાવિક રીતે શ્વાસ લો. શ્વાસ રોકશો નહીં કે જોર કરશો નહીં. અસ્વસ્થતા થાય તો રોકાઈ જાઓ.' },
    ],
  },
  {
    category: 'bonding', slug: 'one-kind-message', contentType: 'affirmation', visibility: 'free', sortOrder: 2,
    translations: [
      { language: 'en', title: 'One kind message', summary: 'Build a small daily bonding ritual.', body: 'Choose one kind and hopeful sentence. Speak it softly to your baby and notice how the moment feels.' },
      { language: 'hi', title: 'एक स्नेहपूर्ण संदेश', summary: 'रोज़ का छोटा सा जुड़ाव अभ्यास।', body: 'एक स्नेहपूर्ण और आशावादी वाक्य चुनें। उसे अपने शिशु से धीरे से कहें और इस पल को महसूस करें।' },
      { language: 'gu', title: 'એક પ્રેમાળ સંદેશ', summary: 'દરરોજનો નાનો જોડાણ અભ્યાસ.', body: 'એક પ્રેમાળ અને આશાવાદી વાક્ય પસંદ કરો. બાળકને ધીમેથી કહો અને આ ક્ષણને અનુભવો.' },
    ],
  },
];

export const seedContentCms = async (models, sequelize, log) => sequelize.transaction(async (transaction) => {
  const adminRole = await models.Role.findOne({ where: { roleType: 'ADMIN' }, transaction });
  const author = adminRole ? await models.User.findOne({ where: { roleId: adminRole.id }, transaction }) : await models.User.findOne({ transaction });
  if (!author) { log.warn('Skipping CMS seed because no author user exists.'); return; }
  const categoryNames = { mindfulness: 'Mindfulness', bonding: 'Baby Bonding' };
  for (const [slug, name] of Object.entries(categoryNames)) {
    await models.ContentCategory.findOrCreate({ where: { slug }, defaults: { name, isActive: true }, transaction });
  }
  for (const definition of seedItems) {
    const { translations, category: categorySlug, ...itemData } = definition;
    const category = await models.ContentCategory.findOne({ where: { slug: categorySlug }, transaction });
    const [item] = await models.ContentItem.findOrCreate({ where: { centerId: null, slug: itemData.slug }, defaults: { ...itemData, categoryId: category.id, createdBy: author.id, updatedBy: author.id, status: 'published', publishAt: new Date() }, transaction });
    await item.update({ ...itemData, categoryId: category.id, updatedBy: author.id, status: 'published', publishAt: item.publishAt || new Date() }, { transaction });
    for (const translation of translations) {
      const [record] = await models.ContentTranslation.findOrCreate({ where: { contentItemId: item.id, language: translation.language }, defaults: { ...translation, contentItemId: item.id }, transaction });
      await record.update(translation, { transaction });
    }
  }
  log.info('Original localized CMS seed is current.');
});
