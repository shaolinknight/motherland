// Vietnamese grammar points, keyed by unit id. Each point is taught inside its
// unit's first lesson and then comes back in reviews like vocabulary.
//
// Point format (language-agnostic, so Spanish conjugations / Japanese particles
// can use the same shape later):
//   title, explain, pattern?, table? (first row = header), examples [[target, english]],
//   drills:
//     ['fill',   'Sentence with ___', [options], 'answer', 'English meaning']
//     ['choose', 'English meaning',   [sentences], correctIndex]
//     ['order',  'Correct sentence.',  'English meaning']

export default {
  u01: [
    {
      title: 'Pronouns are family words',
      explain: 'Vietnamese has no single word for “I” and “you”. You choose a pair based on age and relationship. Talking to an older brother-figure, he is anh and you are em. The same word can mean “I” or “you” depending on who is speaking. Save tôi for formal situations.',
      table: [
        ['Talking to…', 'Call them', 'Call yourself'],
        ['a man a bit older', 'anh', 'em'],
        ['a woman a bit older', 'chị', 'em'],
        ['someone younger', 'em', 'anh / chị'],
        ['your parents’ generation', 'cô / chú / bác', 'con / cháu'],
        ['your grandparents’ generation', 'ông / bà', 'con / cháu'],
        ['a friend your age', 'bạn', 'mình'],
      ],
      examples: [
        ['Anh ăn cơm chưa?', 'Have you eaten? (to an older man)'],
        ['Em cảm ơn chị.', 'Thank you. (younger person to an older woman)'],
        ['Con chào bác.', 'Hello. (to someone older than your parents)'],
      ],
      drills: [
        ['fill', 'Dạ, ___ chào chị.', ['em', 'anh', 'bác'], 'em', 'Hello. (you are younger than her)'],
        ['fill', 'Cháu chào ___.', ['bà', 'em', 'bạn'], 'bà', 'Hello, Grandma.'],
        ['choose', 'To your mom: “I’m home!”', ['Con về rồi!', 'Em về rồi!', 'Tôi về rồi!'], 0],
      ],
    },
    {
      title: '“là” links nouns, not adjectives',
      explain: 'Use là to connect two nouns: “I am a student.” Adjectives like khỏe (well), đẹp (pretty) and mệt (tired) act like verbs on their own, so don’t put là in front of them.',
      pattern: 'noun + là + noun   ·   noun + adjective',
      examples: [
        ['Em là sinh viên.', 'I am a student.'],
        ['Chị ấy là bác sĩ.', 'She is a doctor.'],
        ['Em khỏe.', 'I am well.'],
        ['Cô dâu rất đẹp.', 'The bride is very beautiful.'],
      ],
      drills: [
        ['choose', 'I’m tired.', ['Em mệt.', 'Em là mệt.'], 0],
        ['choose', 'He is an engineer.', ['Anh ấy là kỹ sư.', 'Anh ấy kỹ sư là.'], 0],
        ['order', 'Anh ấy là chú rể.', 'He is the groom.'],
        ['fill', 'Đây ___ ba của em.', ['là', 'có', 'ở'], 'là', 'This is my dad.'],
      ],
    },
  ],
  u02: [{
    title: 'Yes/no questions with có … không',
    explain: 'Wrap the verb or adjective with có … không to ask a yes/no question. Answer with có (yes) or không (no) plus the verb. Southerners usually begin a polite answer with dạ.',
    pattern: 'subject + (có) + verb + không?',
    examples: [
      ['Anh có anh chị em không?', 'Do you have siblings?'],
      ['Dạ có, em có một chị gái.', 'Yes, I have an older sister.'],
      ['Em có mệt không?', 'Are you tired?'],
      ['Dạ không, em không mệt.', 'No, I’m not tired.'],
    ],
    drills: [
      ['fill', 'Chị có khỏe ___?', ['không', 'chưa', 'gì'], 'không', 'Are you well?'],
      ['choose', 'No, I don’t have a wife.', ['Dạ không, em không có vợ.', 'Dạ không, em có không vợ.'], 0],
      ['order', 'Em có thích phở không?', 'Do you like phở?'],
      ['fill', 'Dạ ___, em có hai em trai.', ['có', 'không', 'là'], 'có', 'Yes, I have two younger brothers.'],
    ],
  }],
  u03: [{
    title: 'Possession with của',
    explain: 'The owner comes after the thing, joined by của (“of”): bạn của cô dâu = the bride’s friend. With family and close relationships, của is usually dropped: mẹ em = my mom.',
    pattern: 'thing + (của) + owner',
    examples: [
      ['Em là bạn của cô dâu.', 'I’m a friend of the bride.'],
      ['Nhà của chú rể ở Sài Gòn.', 'The groom’s house is in Saigon.'],
      ['Mẹ em rất vui.', 'My mom is very happy.'],
    ],
    drills: [
      ['order', 'Anh là em họ của chú rể.', 'I’m the groom’s cousin.'],
      ['choose', 'the bride’s family', ['gia đình của cô dâu', 'cô dâu của gia đình'], 0],
      ['fill', 'Đây là bao thư ___ em.', ['của', 'là', 'có'], 'của', 'This is my envelope.'],
    ],
  }],
  u04: [{
    title: 'Putting steps in order',
    explain: 'Describe a sequence with trước (before), sau (after) and rồi or sau đó (then). Trước khi and sau khi go in front of a whole action: trước khi đi = before going.',
    pattern: 'trước khi / sau khi + action   ·   action + rồi + action',
    examples: [
      ['Trước khi rước dâu, nhà trai đến nhà gái.', 'Before bringing the bride home, the groom’s family goes to the bride’s house.'],
      ['Cô dâu chú rể đốt nhang rồi lạy tổ tiên.', 'The bride and groom light incense, then bow to the ancestors.'],
      ['Sau khi làm lễ, mọi người ăn tiệc.', 'After the ceremony, everyone has the banquet.'],
    ],
    drills: [
      ['fill', '___ khi đi, nhớ mặc áo dài.', ['Trước', 'Sau', 'Rồi'], 'Trước', 'Before you go, remember to wear your áo dài.'],
      ['fill', 'Đốt nhang ___ lạy tổ tiên.', ['rồi', 'trước', 'của'], 'rồi', 'Light incense, then bow to the ancestors.'],
      ['order', 'Sau đám hỏi là đám cưới.', 'After the engagement comes the wedding.'],
    ],
  }],
  u05: [{
    title: 'Making a wish with chúc',
    explain: 'Every wish follows one pattern: chúc + who + the wish. Starting with your own pronoun (Em chúc…, Con chúc…) sounds warmer. Add cho before a longer wish: Chúc cho hai bạn luôn hạnh phúc.',
    pattern: '(I) + chúc + person + wish',
    examples: [
      ['Chúc hai bạn hạnh phúc.', 'Wishing you two happiness.'],
      ['Con chúc ông bà sức khỏe.', 'I wish you good health, Grandpa and Grandma.'],
      ['Em chúc anh chị trăm năm hạnh phúc.', 'I wish you a lifetime of happiness.'],
    ],
    drills: [
      ['order', 'Chúc cô dâu chú rể hạnh phúc.', 'Wishing the bride and groom happiness.'],
      ['fill', 'Em ___ anh chị sớm sinh quý tử.', ['chúc', 'cảm ơn', 'mời'], 'chúc', 'I wish you a baby soon.'],
      ['choose', 'Wishing you two a lifetime of happiness!', ['Chúc hai bạn trăm năm hạnh phúc!', 'Hai bạn chúc trăm năm hạnh phúc!'], 0],
    ],
  }],
  u06: [{
    title: 'Formal speech: xin, kính, quý',
    explain: 'In speeches, put xin before a verb to make it humble and polite (xin cảm ơn, xin mời). Kính thưa opens a formal address. Quý (“honored”) goes in front of the people you address: quý vị, quý khách.',
    examples: [
      ['Tôi xin chân thành cảm ơn.', 'I sincerely thank you.'],
      ['Xin mời quý vị nâng ly.', 'Please, everyone, raise your glasses.'],
      ['Kính thưa quý vị.', 'Respected ladies and gentlemen.'],
    ],
    drills: [
      ['fill', 'Tôi ___ cảm ơn quý vị đã đến.', ['xin', 'là', 'có'], 'xin', 'I thank you all for coming.'],
      ['choose', 'Formal: “Please raise your glasses, everyone.”', ['Xin mời quý vị cùng nâng ly.', 'Mọi người nâng ly đi!'], 0],
      ['order', 'Kính thưa quý vị quan khách.', 'Respected honored guests.'],
    ],
  }],
  u07: [
    {
      title: 'Time markers: đã, đang, sẽ, rồi',
      explain: 'Verbs never change form. Put đã before the verb for the past, đang for right now and sẽ for the future. Rồi at the end means “already”. In everyday speech these are often skipped when a time word already makes it clear.',
      table: [
        ['Marker', 'Meaning', 'Example'],
        ['đã', 'past', 'Em đã ăn.'],
        ['đang', 'happening now', 'Em đang ăn.'],
        ['sẽ', 'future', 'Em sẽ ăn.'],
        ['… rồi', 'already', 'Em ăn rồi.'],
      ],
      examples: [
        ['Hôm qua em đã đi làm.', 'Yesterday I went to work.'],
        ['Mẹ đang nấu ăn.', 'Mom is cooking.'],
        ['Ngày mai anh sẽ về nhà.', 'Tomorrow I will go home.'],
      ],
      drills: [
        ['fill', 'Bây giờ em ___ tắm.', ['đang', 'đã', 'sẽ'], 'đang', 'I’m showering right now.'],
        ['fill', 'Tuần sau chị ___ đi Đà Lạt.', ['sẽ', 'đã', 'đang'], 'sẽ', 'Next week I’ll go to Đà Lạt.'],
        ['fill', 'Dạ, con ăn ___.', ['rồi', 'sẽ', 'đang'], 'rồi', 'Yes, I already ate.'],
        ['order', 'Ngày mai em sẽ đi làm.', 'Tomorrow I will go to work.'],
      ],
    },
    {
      title: '“Yet?” questions with chưa',
      explain: 'Ask whether something has happened yet with chưa at the end. Answer rồi (already) or chưa (not yet). That’s why “Ăn cơm chưa?” works as a greeting.',
      pattern: 'subject + verb + chưa?   →   rồi / chưa',
      examples: [
        ['Em ăn cơm chưa?', 'Have you eaten yet?'],
        ['Dạ, em ăn rồi.', 'Yes, I already ate.'],
        ['Dạ chưa, em chưa ăn.', 'Not yet, I haven’t eaten.'],
      ],
      drills: [
        ['fill', 'Anh tắm ___?', ['chưa', 'đang', 'sẽ'], 'chưa', 'Have you showered yet?'],
        ['choose', 'Not yet.', ['Dạ chưa.', 'Dạ rồi.'], 0],
        ['fill', 'Dạ ___, con chưa ngủ.', ['chưa', 'rồi', 'có'], 'chưa', 'Not yet, I haven’t slept.'],
      ],
    },
  ],
  u08: [{
    title: 'mấy vs. bao nhiêu',
    explain: 'Both ask “how many”. Use mấy when you expect a small number (about 10 or less) and for clock time and dates. Use bao nhiêu for bigger or unknown amounts, like prices and age.',
    examples: [
      ['Em có mấy anh chị em?', 'How many siblings do you have?'],
      ['Cái này bao nhiêu tiền?', 'How much is this?'],
      ['Bây giờ là mấy giờ?', 'What time is it now?'],
    ],
    drills: [
      ['fill', 'Nhà em có ___ người?', ['mấy', 'gì', 'đâu'], 'mấy', 'How many people are in your family?'],
      ['fill', 'Cái áo này bao ___ tiền?', ['nhiêu', 'mấy', 'giờ'], 'nhiêu', 'How much is this shirt?'],
      ['fill', 'Bây giờ là ___ giờ?', ['mấy', 'gì', 'đâu'], 'mấy', 'What time is it now?'],
    ],
  }],
  u09: [{
    title: 'Saying when: lúc and date order',
    explain: 'Put the time at the start or the end of the sentence. When it comes after the verb, use lúc (“at”). Dates go from small to big: ngày (day) → tháng (month) → năm (year).',
    pattern: 'time + subject + verb   ·   subject + verb + lúc + time',
    examples: [
      ['Em thức dậy lúc sáu giờ.', 'I wake up at six.'],
      ['Thứ bảy mình đi chơi nha.', 'Let’s go out on Saturday.'],
      ['Đám cưới vào ngày mười tháng mười hai.', 'The wedding is on December 10th.'],
    ],
    drills: [
      ['order', 'Em đi làm lúc tám giờ.', 'I go to work at eight.'],
      ['fill', 'Mình gặp nhau ___ bảy giờ tối.', ['lúc', 'của', 'là'], 'lúc', 'We meet at 7 p.m.'],
      ['choose', 'December 10th', ['ngày mười tháng mười hai', 'tháng mười hai ngày mười'], 0],
    ],
  }],
  u10: [{
    title: 'Classifiers and “this / that”',
    explain: 'When you count or point at things, put a classifier before the noun: cái for most objects, con for animals (including fish), trái for fruit (quả in the North), người for people. Này (this) and đó or kia (that) go after the noun.',
    table: [
      ['Classifier', 'Used for', 'Example'],
      ['cái', 'objects', 'cái áo'],
      ['con', 'animals', 'con cá'],
      ['trái', 'fruit (South)', 'trái xoài'],
      ['người', 'people', 'hai người'],
    ],
    examples: [
      ['Cho em hai con cá.', 'Two fish, please.'],
      ['Cái này bao nhiêu?', 'How much is this one?'],
      ['Em lấy ba trái xoài.', 'I’ll take three mangoes.'],
      ['Con cá đó có tươi không?', 'Is that fish fresh?'],
    ],
    drills: [
      ['fill', 'Cho em hai ___ gà.', ['con', 'cái', 'trái'], 'con', 'Two chickens, please.'],
      ['fill', 'Em lấy một ___ thơm.', ['trái', 'con', 'người'], 'trái', 'I’ll take one pineapple.'],
      ['choose', 'this shirt', ['cái áo này', 'này cái áo'], 0],
      ['order', 'Cái này bán sao vậy cô?', 'How much is this one, ma’am?'],
    ],
  }],
  u11: [{
    title: 'Asking for things: cho, thêm, đừng',
    explain: 'Ask for something with cho + me + the item: Cho anh một ly trà đá. Thêm after the verb means “more”. Say “don’t” with đừng before the verb.',
    pattern: 'cho + me + item   ·   đừng + verb',
    examples: [
      ['Cho em một tô phở.', 'A bowl of phở, please.'],
      ['Cho anh thêm nước mắm.', 'A little more fish sauce for me.'],
      ['Đừng bỏ đá nha.', 'No ice, please.'],
    ],
    drills: [
      ['fill', '___ em xem thực đơn.', ['Cho', 'Đừng', 'Thêm'], 'Cho', 'Let me see the menu.'],
      ['fill', '___ bỏ ngò nha em.', ['Đừng', 'Cho', 'Thêm'], 'Đừng', 'No cilantro, please.'],
      ['order', 'Cho anh thêm đá.', 'More ice for me, please.'],
    ],
  }],
  u12: [{
    title: 'Adjectives after the noun; rất, lắm, quá',
    explain: 'Adjectives follow the noun: phở ngon = delicious phở. For “very”, put rất before the adjective, or lắm after it. Quá after the adjective sounds excited: Ngon quá!',
    pattern: 'noun + adjective   ·   rất + adj   ·   adj + lắm / quá',
    examples: [
      ['Món này rất ngon.', 'This dish is very tasty.'],
      ['Canh chua ngon lắm.', 'The sour soup is really good.'],
      ['Cay quá!', 'So spicy!'],
    ],
    drills: [
      ['choose', 'hot coffee', ['cà phê nóng', 'nóng cà phê'], 0],
      ['choose', 'really delicious', ['ngon lắm', 'lắm ngon'], 0],
      ['fill', 'Món này ___ cay.', ['rất', 'lắm', 'của'], 'rất', 'This dish is very spicy.'],
    ],
  }],
  u13: [{
    title: 'Offering a choice with hay',
    explain: 'In a question, put hay (“or”) between the choices: Uống ở đây hay mang về? In a statement, use hoặc instead.',
    examples: [
      ['Anh uống cà phê hay trà?', 'Do you want coffee or tea?'],
      ['Nóng hay đá ạ?', 'Hot or iced?'],
      ['Em uống trà sữa hoặc sinh tố.', 'I’ll have milk tea or a smoothie.'],
    ],
    drills: [
      ['fill', 'Uống ở đây ___ mang về?', ['hay', 'hoặc', 'với'], 'hay', 'For here or to go?'],
      ['fill', 'Em muốn ly lớn ___ ly nhỏ?', ['hay', 'của', 'với'], 'hay', 'Do you want a large or a small?'],
      ['order', 'Chị uống cà phê hay trà?', 'Would you like coffee or tea?'],
    ],
  }],
  u14: [{
    title: 'Where: ở, ở đâu, từ … tới',
    explain: 'Ở means “at / in” and also “to be located”. Ask where with ở đâu at the end. “From … to” is từ … đến, and Southerners often say tới instead of đến.',
    examples: [
      ['Nhà vệ sinh ở đâu?', 'Where is the restroom?'],
      ['Em ở Sài Gòn.', 'I live in Saigon.'],
      ['Từ đây tới chợ có xa không?', 'Is it far from here to the market?'],
    ],
    drills: [
      ['fill', 'Bệnh viện ___ đâu vậy anh?', ['ở', 'là', 'có'], 'ở', 'Where is the hospital?'],
      ['fill', '___ nhà em tới công ty mất ba mươi phút.', ['Từ', 'Ở', 'Của'], 'Từ', 'It takes thirty minutes from my house to the office.'],
      ['order', 'Nhà chị ở đâu vậy?', 'Where is your house?'],
    ],
  }],
  u15: [{
    title: 'Comparing: hơn, nhất, bằng',
    explain: 'Put hơn after the adjective for “more … than”: lớn hơn (bigger). Nhất means “the most”: đẹp nhất (prettiest). Bằng means “as … as”.',
    pattern: 'adj + hơn   ·   adj + nhất   ·   adj + bằng',
    examples: [
      ['Cái này rẻ hơn cái kia.', 'This one is cheaper than that one.'],
      ['Cái áo đỏ đẹp nhất.', 'The red shirt is the prettiest.'],
      ['Anh cao bằng ba anh.', 'I’m as tall as my dad.'],
    ],
    drills: [
      ['fill', 'Cái này mắc ___ cái kia.', ['hơn', 'nhất', 'bằng'], 'hơn', 'This one is more expensive than that one.'],
      ['fill', 'Đây là cái đầm đẹp ___.', ['nhất', 'hơn', 'bằng'], 'nhất', 'This is the prettiest dress.'],
      ['choose', 'smaller', ['nhỏ hơn', 'hơn nhỏ'], 0],
    ],
  }],
  u16: [{
    title: 'bị (bad things) vs. được (good things)',
    explain: 'Bị marks something unpleasant happening to you: bị bệnh, bị mất bóp. Được marks something good, or being allowed to: được nghỉ, được lì xì. Same position, opposite feeling.',
    examples: [
      ['Em bị sốt.', 'I have a fever.'],
      ['Anh bị đau đầu.', 'I have a headache.'],
      ['Hôm nay em được nghỉ.', 'I get the day off today.'],
      ['Con được bà lì xì.', 'Grandma gave me lucky money.'],
    ],
    drills: [
      ['fill', 'Em ___ đau bụng.', ['bị', 'được', 'có'], 'bị', 'I have a stomachache.'],
      ['fill', 'Tuần này anh ___ nghỉ phép.', ['được', 'bị', 'là'], 'được', 'This week I get time off.'],
      ['choose', 'I lost my wallet.', ['Tôi bị mất bóp.', 'Tôi được mất bóp.'], 0],
    ],
  }],
  u17: [{
    title: 'Weather with trời; “probably” with chắc',
    explain: 'Weather sentences use trời (sky) as the subject: Trời nóng = it’s hot. Put chắc first to mean “probably”. Đang mưa means it’s raining right now.',
    examples: [
      ['Trời nóng quá!', 'It’s so hot!'],
      ['Chắc chiều nay trời mưa.', 'It’ll probably rain this afternoon.'],
      ['Ngoài trời đang mưa.', 'It’s raining outside.'],
    ],
    drills: [
      ['fill', '___ nắng quá!', ['Trời', 'Ngày', 'Mưa'], 'Trời', 'It’s so sunny!'],
      ['fill', '___ mai trời mát.', ['Chắc', 'Rất', 'Của'], 'Chắc', 'It’ll probably be cool tomorrow.'],
      ['order', 'Hôm nay trời mưa to.', 'It’s raining hard today.'],
    ],
  }],
  u18: [{
    title: 'Asking for help: giùm, giúp',
    explain: 'To ask someone to do something for you, add giùm (South) or giúp / hộ (North) after the action, followed by who it’s for: Mở cửa giùm em. Add nha at the end to sound friendly.',
    pattern: 'action + giùm + person (+ nha)',
    examples: [
      ['Rửa chén giùm mẹ nha.', 'Wash the dishes for me, okay? (Mom speaking)'],
      ['Anh mở máy lạnh giùm em.', 'Please turn on the AC for me.'],
      ['Chị giúp em với!', 'Please help me!'],
    ],
    drills: [
      ['fill', 'Con đổ rác ___ mẹ nha.', ['giùm', 'của', 'được'], 'giùm', 'Take out the trash for me, okay?'],
      ['order', 'Mở cửa giùm anh nha.', 'Please open the door for me.'],
      ['fill', 'Anh ___ em với!', ['giúp', 'bị', 'hơn'], 'giúp', 'Help me!'],
    ],
  }],
  u19: [{
    title: 'Groups: các, mọi người, cả',
    explain: 'Nouns don’t change for plural. Put các in front for “all the …”, or use a number. Mọi người means everyone, and cả nhà means the whole family.',
    examples: [
      ['Con chúc các cô chú năm mới vui vẻ.', 'Happy New Year to all my aunts and uncles.'],
      ['Cả nhà cùng gói bánh tét.', 'The whole family wraps bánh tét together.'],
      ['Chúc mọi người năm mới hạnh phúc.', 'Happy New Year, everyone.'],
    ],
    drills: [
      ['fill', 'Con chúc ___ anh chị năm mới vui vẻ.', ['các', 'cái', 'con'], 'các', 'Happy New Year to all of you.'],
      ['fill', '___ nhà đi chùa.', ['Cả', 'Các', 'Mọi'], 'Cả', 'The whole family goes to the pagoda.'],
      ['order', 'Chúc mọi người năm mới vui vẻ.', 'Happy New Year, everyone.'],
    ],
  }],
  u20: [{
    title: 'Ending particles: nha, đi, hả, nè',
    explain: 'Small words at the end of a sentence change its feeling. Nha (South) or nhé (North) softens a request. Đi pushes an invitation. Hả (South) or à turns a statement into a surprised question. Nè (South) means “here, look”.',
    table: [
      ['Particle', 'Feeling', 'Example'],
      ['nha', 'friendly “okay?”', 'Mai gặp nha.'],
      ['đi', '“let’s” / “go ahead”', 'Đi ăn đi!'],
      ['hả', '“really?”', 'Anh tới rồi hả?'],
      ['nè', '“here / look”', 'Tiền nè.'],
    ],
    examples: [
      ['Mai gặp nha!', 'See you tomorrow!'],
      ['Mình đi xem phim đi!', 'Let’s go see a movie!'],
      ['Em tới rồi hả?', 'You’re here already?'],
    ],
    drills: [
      ['fill', 'Tối nay đi ăn ___!', ['đi', 'hả', 'nè'], 'đi', 'Let’s go eat tonight!'],
      ['fill', 'Anh bị kẹt xe ___?', ['hả', 'đi', 'nè'], 'hả', 'You’re stuck in traffic?'],
      ['fill', 'Tới nơi nhắn anh ___.', ['nha', 'hả', 'nè'], 'nha', 'Text me when you get there, okay?'],
    ],
  }],
  u21: [{
    title: 'must, should, want, need',
    explain: 'Put these before the main verb: phải (must / have to), nên (should), muốn (want to), cần (need to). Put không in front to negate: không cần (don’t need to), không nên (shouldn’t).',
    pattern: 'subject + phải / nên / muốn / cần + verb',
    examples: [
      ['Tuần này em phải làm thêm.', 'I have to work overtime this week.'],
      ['Anh nên nghỉ ngơi.', 'You should rest.'],
      ['Em muốn đổi việc.', 'I want to change jobs.'],
      ['Mai em không cần đi làm.', 'I don’t need to go to work tomorrow.'],
    ],
    drills: [
      ['fill', 'Mai em ___ đi họp sớm.', ['phải', 'được', 'của'], 'phải', 'Tomorrow I have to go to a meeting early.'],
      ['fill', 'Anh mệt thì ___ nghỉ đi.', ['nên', 'bị', 'hơn'], 'nên', 'If you’re tired, you should rest.'],
      ['order', 'Em muốn làm về quảng cáo.', 'I want to work in advertising.'],
    ],
  }],
  u22: [{
    title: 'Respect words: dạ, ạ, thưa',
    explain: 'With elders, begin replies with dạ and end sentences with ạ. Thưa before a title is very respectful. Leaving them out is fine between friends, but with elders it can sound cold.',
    examples: [
      ['Dạ, con khỏe ạ.', 'I’m well. (polite)'],
      ['Bác khỏe không ạ?', 'Are you well? (to an elder)'],
      ['Thưa bà, con mới về.', 'Grandma, I’m home. (respectful)'],
    ],
    drills: [
      ['choose', 'To Grandma: “Thank you.”', ['Dạ, con cảm ơn bà ạ.', 'Cảm ơn nha.'], 0],
      ['fill', 'Con chào cô ___.', ['ạ', 'đi', 'hả'], 'ạ', 'Hello. (polite, to an aunt-aged woman)'],
      ['order', 'Dạ, con chưa có người yêu ạ.', 'I don’t have a sweetheart yet.'],
    ],
  }],
  u23: [{
    title: 'How often: thường, hay, luôn, ít khi',
    explain: 'Frequency words go before the verb. Thường = usually, hay = often, luôn = always, ít khi = rarely, không bao giờ = never.',
    pattern: 'subject + frequency + verb',
    examples: [
      ['Cuối tuần em thường đi biển.', 'On weekends I usually go to the beach.'],
      ['Anh hay chơi game.', 'I often play video games.'],
      ['Chị luôn uống cà phê buổi sáng.', 'I always drink coffee in the morning.'],
      ['Em ít khi hát karaoke.', 'I rarely sing karaoke.'],
    ],
    drills: [
      ['fill', 'Sáng chủ nhật anh ___ đá banh.', ['thường', 'hơn', 'của'], 'thường', 'On Sunday mornings I usually play soccer.'],
      ['choose', 'I never play games.', ['Em không bao giờ chơi game.', 'Em chơi game không bao giờ.'], 0],
      ['order', 'Em hay nghe nhạc buổi tối.', 'I often listen to music in the evening.'],
    ],
  }],
  u24: [{
    title: 'Urgency: với, ngay, gấp',
    explain: 'Với at the end of a request makes it urgent or pleading: Cứu tôi với! Ngay means right away, and gấp means urgent.',
    examples: [
      ['Cứu tôi với!', 'Help me!'],
      ['Gọi cấp cứu ngay!', 'Call an ambulance right now!'],
      ['Tôi cần gặp bác sĩ gấp.', 'I need to see a doctor urgently.'],
    ],
    drills: [
      ['fill', 'Giúp tôi ___!', ['với', 'của', 'hơn'], 'với', 'Please help me!'],
      ['fill', 'Anh gọi công an ___ đi!', ['ngay', 'lắm', 'hơn'], 'ngay', 'Call the police right away!'],
      ['order', 'Tôi cần đi bệnh viện gấp.', 'I need to go to the hospital urgently.'],
    ],
  }],
  // ── v1.3 units (data/vi-c.js), marked “needs family check” ──
  u25: [{
    title: 'Purpose with để',
    explain: 'Put để before a verb to say why you do something: “in order to / so that”. At the start of a sentence, “Để em…” means “Let me…”.',
    pattern: 'action + để + purpose · Để em + verb',
    examples: [
      ['Anh ghé nhà hàng để xếp chỗ.', 'I’m stopping by the restaurant to arrange the seating.'],
      ['Mình dậy sớm để trang điểm.', 'We get up early to do makeup.'],
      ['Họ chọn giờ đẹp để làm lễ.', 'They choose an auspicious hour for the ceremony.'],
      ['Để em gọi thợ chụp hình.', 'Let me call the photographer.'],
    ],
    drills: [
      ['fill', 'Chị đi chợ ___ mua trái cây.', ['để', 'của', 'với'], 'để', 'She goes to the market to buy fruit.'],
      ['fill', 'Mình đặt cọc ___ giữ chỗ.', ['để', 'hay', 'của'], 'để', 'We pay a deposit to hold the booking.'],
      ['choose', 'Let me call him.', ['Để em gọi anh ấy.', 'Em để gọi anh ấy.', 'Gọi để em anh ấy.'], 0],
      ['order', 'Anh ấy học tiếng Việt để nói chuyện với ông bà.', 'He learns Vietnamese to talk with his grandparents.'],
    ],
  }],
  u26: [{
    title: 'Also and all: cũng, đều',
    explain: 'Cũng means “also, too” and đều means “all / both (each one of them)”. Both go after the subject and right before the verb or adjective. “Ai cũng…” means “everyone…”.',
    pattern: 'subject + cũng / đều + verb',
    table: [
      ['Word', 'Meaning', 'Example'],
      ['cũng', 'also, too', 'Chú Tư cũng về.'],
      ['đều', 'all, both', 'Hai đứa đều về.'],
      ['ai cũng', 'everyone', 'Ai cũng vui.'],
    ],
    examples: [
      ['Chú Tư cũng về ăn giỗ.', 'Uncle Tư is also coming for the death anniversary.'],
      ['Bên nội với bên ngoại đều tới.', 'Both sides of the family came.'],
      ['Ai cũng thương bà.', 'Everyone loves Grandma.'],
      ['Mấy đứa nhỏ đều ngoan.', 'The kids are all well-behaved.'],
    ],
    drills: [
      ['fill', 'Má về, ba ___ về.', ['cũng', 'đều', 'để'], 'cũng', 'Mom is coming, and Dad is too.'],
      ['fill', 'Ba anh em ___ thích ăn bánh xèo.', ['đều', 'của', 'để'], 'đều', 'All three siblings like bánh xèo.'],
      ['choose', 'Everyone came.', ['Ai cũng tới.', 'Ai tới cũng.', 'Cũng ai tới.'], 0],
      ['order', 'Con cháu ở xa cũng về ăn giỗ.', 'Children and grandchildren who live far away also come back for the anniversary.'],
    ],
  }],
  u27: [{
    title: 'Passing on a message: nói, kêu, hỏi',
    explain: 'To report what someone said, use nói (là): “said (that)”. To pass on a request, Saigon uses kêu (Hanoi bảo): “A kêu B + verb” = A told B to do something. To report a question, use hỏi.',
    pattern: 'A nói (là) … · A kêu B + verb · A hỏi …',
    examples: [
      ['Má nói là má khỏe.', 'Mom said she’s fine.'],
      ['Ba kêu con gọi lại.', 'Dad told me to call back.'],
      ['Ngoại hỏi khi nào con về.', 'Grandma asked when I’m coming home.'],
      ['Chị kêu em nhắn tin cho chị.', 'My sister told me to text her.'],
    ],
    drills: [
      ['fill', 'Ba ___ con về sớm.', ['kêu', 'của', 'là'], 'kêu', 'Dad told me to come home early.'],
      ['fill', 'Bà ___ con ăn cơm chưa.', ['hỏi', 'kêu', 'để'], 'hỏi', 'Grandma asked whether I’d eaten.'],
      ['choose', 'Mom said she misses me.', ['Má nói là má nhớ con.', 'Má nhớ nói là con.', 'Nói má là nhớ con.'], 0],
      ['order', 'Chú kêu con nhớ gọi điện cho ông.', 'Uncle told me to remember to call Grandpa.'],
    ],
  }],
  u28: [{
    title: 'Ordering amounts: một tô, hai dĩa, ba ly',
    explain: 'When ordering, say the number, then the container or portion word, then the food: “hai dĩa cơm tấm”. The container word works like a classifier. Saigon and Hanoi use different ones.',
    pattern: 'number + tô / dĩa / chén / ly / phần + food',
    table: [
      ['Saigon', 'Hanoi', 'Example'],
      ['tô', 'bát', 'một tô phở'],
      ['dĩa', 'đĩa', 'hai dĩa cơm tấm'],
      ['chén', 'bát', 'ba chén cơm'],
      ['ly', 'cốc', 'bốn ly cà phê sữa đá'],
    ],
    examples: [
      ['Cho em một tô phở bò.', 'One bowl of beef phở, please.'],
      ['Cho hai dĩa cơm tấm sườn.', 'Two plates of broken rice with pork chop, please.'],
      ['Thêm ba chén cơm nữa.', 'Three more bowls of rice.'],
      ['Cho tụi em bốn ly nước mía.', 'Four glasses of sugarcane juice for us.'],
    ],
    drills: [
      ['fill', 'Cho em hai ___ cơm tấm.', ['dĩa', 'ly', 'cái'], 'dĩa', 'Two plates of broken rice, please.'],
      ['fill', 'Cho anh một ___ cà phê sữa đá.', ['ly', 'tô', 'chén'], 'ly', 'One iced milk coffee, please.'],
      ['choose', 'Three bowls of phở, please.', ['Cho ba tô phở.', 'Cho phở tô ba.', 'Cho tô ba phở.'], 0],
      ['order', 'Cho tụi em thêm hai chén cơm nữa.', 'Two more bowls of rice for us, please.'],
    ],
  }],
  u29: [{
    title: 'Only and just: chỉ … thôi',
    explain: 'Chỉ before the verb or number means “only”. Thôi at the end of a sentence means “just, that’s all”. They often go together: “chỉ … thôi”. At the start of a reply, “Thôi” means “never mind / that’s enough”.',
    pattern: 'chỉ + verb / number … (thôi)',
    examples: [
      ['Hai trăm thôi.', 'Just two hundred.'],
      ['Em chỉ có một trăm thôi.', 'I only have a hundred.'],
      ['Chị chỉ bớt được chút thôi.', 'I can only take a little off.'],
      ['Thôi, em không mua nữa.', 'Never mind, I won’t buy it.'],
    ],
    drills: [
      ['fill', 'Em ___ mua một cái thôi.', ['chỉ', 'của', 'để'], 'chỉ', 'I’m only buying one.'],
      ['fill', 'Cái này năm chục ___.', ['thôi', 'chỉ', 'để'], 'thôi', 'This one is just fifty.'],
      ['choose', 'I only have fifty thousand.', ['Em chỉ có năm chục thôi.', 'Em có chỉ năm chục thôi.', 'Thôi em có năm chục chỉ.'], 0],
      ['order', 'Chị chỉ bán giá này thôi.', 'I only sell at this price.'],
    ],
  }],
  u30: [{
    title: 'Doses and times: mỗi, lần',
    explain: 'Lần means “time(s)”. “Ngày uống ba lần” = take it three times a day (literally “day, take three times”). Mỗi means “each, every”: “mỗi lần một viên” = one pill each time, “mỗi ngày” = every day.',
    pattern: 'ngày + verb + number + lần · mỗi lần + amount',
    examples: [
      ['Ngày uống hai lần.', 'Take it twice a day.'],
      ['Mỗi lần uống một viên.', 'Take one pill each time.'],
      ['Mỗi ngày em đi bộ ba mươi phút.', 'Every day I walk for thirty minutes.'],
      ['Một tuần em đi bơi hai lần.', 'I go swimming twice a week.'],
    ],
    drills: [
      ['fill', 'Ngày uống ba ___.', ['lần', 'viên', 'mỗi'], 'lần', 'Take it three times a day.'],
      ['fill', '___ lần một viên.', ['Mỗi', 'Lần', 'Ngày'], 'Mỗi', 'One pill each time.'],
      ['choose', 'Take it twice a day, after eating.', ['Ngày uống hai lần, sau khi ăn.', 'Hai ngày uống lần, sau khi ăn.', 'Uống lần hai ngày, sau khi ăn.'], 0],
      ['order', 'Mỗi ngày em uống thuốc hai lần.', 'I take medicine twice every day.'],
    ],
  }],
  u31: [{
    title: 'Question words stay in place: gì, đâu, ai',
    explain: 'English moves question words to the front. Vietnamese leaves them where the answer goes: “Em ăn gì?” (you eat what?) → “Em ăn phở.” Khi nào (when) usually goes first when asking about plans. In texts, gì is often written j and vậy z.',
    pattern: 'subject + verb + gì / đâu / ai?',
    examples: [
      ['Em ăn gì?', 'What are you eating?'],
      ['Anh đi đâu vậy?', 'Where are you going?'],
      ['Ai gọi em?', 'Who called you?'],
      ['Khi nào em về?', 'When are you coming back?'],
    ],
    drills: [
      ['fill', 'Chị mua ___ vậy?', ['gì', 'ai', 'khi'], 'gì', 'What are you buying?'],
      ['fill', 'Em ở ___ vậy?', ['đâu', 'gì', 'ai'], 'đâu', 'Where are you?'],
      ['choose', 'What are you doing?', ['Em làm gì vậy?', 'Gì em làm vậy?', 'Em gì làm vậy?'], 0],
      ['order', 'Tối nay mình đi ăn ở đâu?', 'Where are we going to eat tonight?'],
    ],
  }],
  // ── v1.4 units (data/vi-d.js), marked “needs family check” ──
  u32: [{
    title: 'Direction words after verbs: vô, ra, lên, xuống',
    explain: 'Vietnamese adds a direction word after a verb to show where something goes: bỏ vô (put in), lấy ra (take out), đem lên (bring up), để xuống (put down). Saigon says vô; Hanoi says vào.',
    pattern: 'verb + vô / ra / lên / xuống (+ place)',
    table: [
      ['Word', 'Hanoi', 'Example'],
      ['vô', 'vào', 'Bỏ muối vô nồi.'],
      ['ra', 'ra', 'Lấy cá ra.'],
      ['lên', 'lên', 'Đem đồ ăn lên lầu.'],
      ['xuống', 'xuống', 'Để nồi xuống.'],
    ],
    examples: [
      ['Bỏ tỏi vô chảo.', 'Put the garlic in the pan.'],
      ['Lấy thịt ra khỏi tủ lạnh.', 'Take the meat out of the fridge.'],
      ['Dọn cơm ra đi con.', 'Bring the food out.'],
      ['Để cái nồi xuống bàn.', 'Put the pot down on the table.'],
    ],
    drills: [
      ['fill', 'Bỏ đường ___ nồi.', ['vô', 'ra', 'lên'], 'vô', 'Put the sugar into the pot.'],
      ['fill', 'Lấy cá ___ khỏi tủ lạnh.', ['ra', 'vô', 'lên'], 'ra', 'Take the fish out of the fridge.'],
      ['choose', 'Put it in the pan.', ['Bỏ vô chảo.', 'Vô bỏ chảo.', 'Chảo bỏ vô.'], 0],
      ['order', 'Con lấy rau ra rửa đi.', 'Take the vegetables out and wash them.'],
    ],
  }],
  u33: [{
    title: 'Looks like: nhìn, giống',
    explain: 'Nhìn + adjective means “looks …”: Anh nhìn mệt quá (you look really tired). Giống means “to look like, resemble”: giống ba (looks like Dad). Giống nhau = look alike. Add quá or ghê for “so”.',
    pattern: 'nhìn + adjective · giống + person',
    examples: [
      ['Anh nhìn mệt quá.', 'You look really tired.'],
      ['Con gái giống má.', 'The daughter looks like her mom.'],
      ['Hai anh em nhìn giống nhau ghê.', 'The two brothers look so alike.'],
      ['Áo này nhìn đẹp quá.', 'This shirt looks really nice.'],
    ],
    drills: [
      ['fill', 'Em ___ giống ba lắm.', ['nhìn', 'hơn', 'để'], 'nhìn', 'You look a lot like your dad.'],
      ['fill', 'Bé này ___ má nó.', ['giống', 'của', 'để'], 'giống', 'This child looks like his mom.'],
      ['choose', 'You look so young!', ['Nhìn trẻ quá!', 'Trẻ nhìn quá!', 'Quá nhìn trẻ!'], 0],
      ['order', 'Hai chị em nhìn giống nhau ghê.', 'The two sisters look so alike.'],
    ],
  }],
  u34: [{
    title: 'Ordinals: thứ nhất, thứ hai, thứ tư',
    explain: 'Put thứ before a number to say “second, third…”: hẻm thứ hai = the second alley. Two are irregular: “first” is thứ nhất (not thứ một) and “fourth” is thứ tư (not thứ bốn).',
    pattern: 'noun + thứ + number',
    table: [
      ['Number', 'Ordinal', 'Example'],
      ['1', 'thứ nhất', 'lần thứ nhất'],
      ['2', 'thứ hai', 'hẻm thứ hai'],
      ['3', 'thứ ba', 'căn thứ ba'],
      ['4', 'thứ tư', 'tầng thứ tư'],
    ],
    examples: [
      ['Quẹo vô hẻm thứ hai.', 'Turn into the second alley.'],
      ['Nhà em là căn thứ ba bên phải.', 'My house is the third one on the right.'],
      ['Đây là lần thứ nhất em tới Sài Gòn.', 'This is my first time in Saigon.'],
      ['Văn phòng ở tầng thứ tư.', 'The office is on the fourth floor.'],
    ],
    drills: [
      ['fill', 'Quẹo phải ở ngã tư thứ ___.', ['nhất', 'một', 'bốn'], 'nhất', 'Turn right at the first intersection.'],
      ['fill', 'Nhà tôi là căn thứ ___ bên trái.', ['tư', 'bốn', 'một'], 'tư', 'My house is the fourth one on the left.'],
      ['choose', 'the second alley', ['hẻm thứ hai', 'thứ hai hẻm', 'hẻm hai thứ'], 0],
      ['order', 'Văn phòng ở tầng thứ tư.', 'The office is on the fourth floor.'],
    ],
  }],
  u35: [{
    title: 'Talking about the past: hồi nhỏ, hồi đó, từng',
    explain: 'Vietnamese verbs don’t change for the past; time words do the work: hồi nhỏ (as a child), hồi đó (back then), hồi xưa (in the old days). Từng or đã từng before a verb means “have ever / used to”: Bà từng sống ở Huế.',
    pattern: 'hồi + time, subject + verb · subject + (đã) từng + verb',
    examples: [
      ['Hồi nhỏ em ở Cần Thơ.', 'As a child I lived in Cần Thơ.'],
      ['Hồi đó không có điện thoại.', 'Back then there were no phones.'],
      ['Ông từng làm thầy giáo.', 'Grandpa used to be a teacher.'],
      ['Con đã từng ăn sầu riêng chưa?', 'Have you ever eaten durian?'],
    ],
    drills: [
      ['fill', '___ nhỏ bà hay tắm sông.', ['Hồi', 'Từng', 'Sẽ'], 'Hồi', 'As a child, Grandma often swam in the river.'],
      ['fill', 'Ba ___ sống ở Đà Lạt.', ['từng', 'hồi', 'sẽ'], 'từng', 'Dad used to live in Đà Lạt.'],
      ['choose', 'Have you ever been to Huế?', ['Em đã từng đi Huế chưa?', 'Em từng chưa đi Huế?', 'Từng em đi Huế chưa?'], 0],
      ['order', 'Hồi đó nhà ông nghèo lắm.', 'Back then Grandpa’s family was very poor.'],
    ],
  }],
  u36: [{
    title: 'Because … so: vì … nên',
    explain: 'Vì (because) introduces the reason and nên (so) the result: Vì trời mưa nên mình ở nhà. Either half can also stand alone. In casual Southern speech, tại (because) is very common too.',
    pattern: 'Vì + reason + nên + result',
    examples: [
      ['Vì hôm nay là rằm nên cả nhà ăn chay.', 'Because today is the full moon, the whole family eats vegetarian.'],
      ['Vì trời mưa nên mình ở nhà.', 'Because it’s raining, we’re staying home.'],
      ['Em mệt nên đi ngủ sớm.', 'I’m tired, so I’m going to bed early.'],
      ['Tại kẹt xe nên em tới trễ.', 'I’m late because of the traffic.'],
    ],
    drills: [
      ['fill', 'Vì trời mưa ___ mình không đi.', ['nên', 'vì', 'của'], 'nên', 'Because it’s raining, we’re not going.'],
      ['fill', '___ hôm nay là Trung Thu nên tụi nhỏ vui lắm.', ['Vì', 'Nên', 'Để'], 'Vì', 'Because today is Mid-Autumn, the kids are really happy.'],
      ['choose', 'I’m late because of the traffic.', ['Tại kẹt xe nên em tới trễ.', 'Nên kẹt xe tại em tới trễ.', 'Em tới trễ nên tại kẹt xe.'], 0],
      ['order', 'Vì em đói nên em ăn trước.', 'Because I’m hungry, I’m eating first.'],
    ],
  }],
  u37: [{
    title: 'Can and can’t: được, có thể',
    explain: 'Put được after a verb to say something is possible or allowed: chuyển khoản được (you can pay by transfer). Không + verb + được means can’t: Em không rút tiền được. Có thể before the verb also means can or may, and sounds a bit more formal.',
    pattern: 'verb + được · không + verb + được · có thể + verb',
    examples: [
      ['Ở đây trả thẻ được không?', 'Can I pay by card here?'],
      ['Em không rút tiền được.', 'I can’t withdraw money.'],
      ['Chị có thể chuyển khoản.', 'You can pay by bank transfer.'],
      ['Quét mã được rồi.', 'The scan worked.'],
    ],
    drills: [
      ['fill', 'Em trả bằng thẻ ___ không?', ['được', 'để', 'nên'], 'được', 'Can I pay by card?'],
      ['fill', 'Máy này không rút tiền ___.', ['được', 'có', 'nên'], 'được', 'This machine can’t dispense cash.'],
      ['choose', 'I can’t open the app.', ['Em không mở ứng dụng được.', 'Em được không mở ứng dụng.', 'Không em mở được ứng dụng.'], 0],
      ['order', 'Chị có thể quét mã ở đây.', 'You can scan the code here.'],
    ],
  }],
};
