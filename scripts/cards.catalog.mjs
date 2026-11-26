// Credit card pictures: which source image is which card, and where its sample cardholder
// name / card number sit (so scripts/build-cards.mjs can erase them).
//
// src:   a unique part of the source file name
// bank:  institution id of the card issuer in lib/institutions.ts ("<bank>-cc")
// net:   card network
// v:     true for portrait (vertical) cards
// erase: rectangles [x0, y0, x1, y1] in percent of the cropped card, filled in from their surroundings
// tol:   how different from the page background a pixel must be to count as card (default 40)
// trim:  extra crop [top, right, bottom, left] in percent, for pictures with a frame around the card
// full:  the picture is the card edge to edge (no page background to find)

// Left out (artwork too busy to erase the name cleanly): HSBC Red, BPI Corporate, Robinsons Cashback,
// Metrobank Dollar Platinum, PSBank Credit, RCBC Flex, RCBC Flex Gold, PNB PAL Mabuhay Miles (skyline).
// Not cards or not credit: debit and prepaid cards, corporate cards, promo banners, older card designs.
export const CARDS = [
  // BPI
  { id: "bpi-free", bank: "bpi-cc", name: "BPI Free+ Visa Platinum", net: "visa", src: "bpi-free_BPI_20FREE", tol: 52, erase: [[5, 76, 55, 90]] },
  { id: "bpi-omni", bank: "bpi-cc", name: "BPI Omni Mastercard", net: "mastercard", v: true, src: "bpi-omni_content-card", tol: 65, trim: [6.5, 0, 0, 0], erase: [[8, 60, 86, 70]] },
  { id: "bpi-signature", bank: "bpi-cc", name: "BPI Visa Signature", net: "visa", src: "credit-cards-rebranding_content-card.png", tol: 65, erase: [[6, 82, 73, 95]] },
  { id: "bpi-wealth", bank: "bpi-cc", name: "BPI Wealth Visa Signature", net: "visa", src: "signature-wealth-card", tol: 65, erase: [] },
  // Security Bank
  { id: "sb-world", bank: "securitybank-cc", name: "Security Bank World Mastercard", net: "mastercard", src: "CCV2-World_Contactless", erase: [[5, 54, 98, 72], [5, 72, 64, 84], [5, 84, 50, 99]] },
  // China Bank
  { id: "cbc-wealth", bank: "chinabank-cc", name: "Wealth World Elite Mastercard", net: "mastercard", v: true, src: "THE_CARD_THAT_HAS_THE_BEST_FEATURES", erase: [[4, 71, 40, 77]] },
  { id: "cbc-velvet", bank: "chinabank-cc", name: "Velvet Visa Signature", net: "visa", v: true, src: "THE_CARD_THAT_LETS_YOU_TAKE_CHARGE", erase: [[2, 76.5, 55, 85]] },
  { id: "cbc-home", bank: "chinabank-cc", name: "@home Visa Platinum", net: "visa", v: true, src: "THE_CREDIT_CARD_FOR_YOUR_FAMILY", erase: [[1, 76.5, 60, 86]] },
  { id: "cbc-platinum", bank: "chinabank-cc", name: "Platinum Mastercard", net: "mastercard", v: true, src: "The_Premium_Card_for_Fuel", erase: [[4, 78, 60, 84]] },
  { id: "cbc-world", bank: "chinabank-cc", name: "World Mastercard", net: "mastercard", v: true, src: "The_Ultimate_Card_with_the_Highest", erase: [[4, 78, 58, 84]] },
  { id: "cbc-freedom", bank: "chinabank-cc", name: "Freedom Platinum Mastercard", net: "mastercard", v: true, src: "The_card_you_ve_always_wanted", erase: [[3, 75.5, 64, 85]] },
  { id: "cbc-prime", bank: "chinabank-cc", name: "Prime Mastercard", net: "mastercard", v: true, src: "The_everyday_card", erase: [[3, 75.5, 60, 85]] },
  { id: "cbc-cashrewards", bank: "chinabank-cc", name: "Cash Rewards Mastercard", net: "mastercard", v: true, src: "The_must-have_rebate_card", erase: [[4, 75.5, 60, 85]] },
  { id: "cbc-destinations-world", bank: "chinabank-cc", name: "Destinations World Mastercard", net: "mastercard", v: true, src: "YOUR_GATEWAY_TO_LUXURIOUS_JOURNEYS", erase: [[3, 75, 62, 81]] },
  { id: "cbc-destinations-plat", bank: "chinabank-cc", name: "Destinations Platinum Mastercard", net: "mastercard", v: true, src: "YOUR_PASSPORT_TO_SMART_TRAVELS", erase: [[4, 79, 58, 85]] },
  // EastWest
  { id: "ew-krisflyer-plat", bank: "eastwest-cc", name: "KrisFlyer Platinum Mastercard", net: "mastercard", src: "platinum1.png_Singapore_Airlines", erase: [[1, 83, 45, 95]] },
  { id: "ew-krisflyer-world", bank: "eastwest-cc", name: "KrisFlyer World Mastercard", net: "mastercard", src: "world2.png_Singapore_Airlines", erase: [[1, 83, 45, 95]] },
  { id: "ew-puregold", bank: "eastwest-cc", name: "Puregold Always Panalo Visa", net: "visa", src: "Puregold_Always_Panalo", erase: [[3, 82, 50, 95]] },
  { id: "ew-dolcevita", bank: "eastwest-cc", name: "Dolce Vita Titanium Mastercard", net: "mastercard", src: "dolce-vita-titanium", erase: [[7, 55, 62, 91]] },
  { id: "ew-everyday", bank: "eastwest-cc", name: "EveryDay Titanium Mastercard", net: "mastercard", src: "everyday-mc_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-gold-mc", bank: "eastwest-cc", name: "Gold Mastercard", net: "mastercard", src: "gold-mc-emv_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-gold-visa", bank: "eastwest-cc", name: "Gold Visa", net: "visa", src: "gold-visa-emv_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-jcb-gold", bank: "eastwest-cc", name: "JCB Gold", net: "jcb", src: "jcb-gold_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-jcb-plat", bank: "eastwest-cc", name: "JCB Platinum", net: "jcb", src: "jcb-platinum_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-plat-mc", bank: "eastwest-cc", name: "Platinum Mastercard", net: "mastercard", src: "platinum-mc-emv_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-privilege-mc", bank: "eastwest-cc", name: "Privilege Mastercard", net: "mastercard", src: "silver-mc-emv_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-privilege-visa", bank: "eastwest-cc", name: "Privilege Visa", net: "visa", src: "silver-visa-emv_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-visa-plat", bank: "eastwest-cc", name: "Visa Platinum", net: "visa", src: "visa-platinum-emv_2025", erase: [[7, 56, 59, 90]] },
  { id: "ew-priority", bank: "eastwest-cc", name: "Priority Visa Infinite", net: "visa", src: "visa-infinite_0.png_Priority", erase: [[3, 84, 55, 95]] },
  // HSBC
  { id: "hsbc-live", bank: "hsbc-cc", name: "HSBC Live+ Visa", net: "visa", v: true, src: "HSBC_Gold_Visa_Cashback", trim: [10, 0, 9.5, 0], erase: [] },
  // Metrobank / PSBank
  { id: "mb-hype", bank: "metrobank-cc", name: "Hype Visa", net: "visa", v: true, src: "Hype_card_preview", erase: [] },
  { id: "mb-cashback", bank: "metrobank-cc", name: "Cashback Visa", net: "visa", src: "Metrobank_Cashback_Visa_preview", erase: [] },
  { id: "mb-titanium", bank: "metrobank-cc", name: "Titanium Mastercard", net: "mastercard", src: "Metrobank_Titanium_Mastercard_preview", erase: [[3, 57, 60, 94]] },
  { id: "mb-world", bank: "metrobank-cc", name: "World Mastercard", net: "mastercard", src: "Metrobank_World_Mastercard_preview", erase: [] },
  { id: "mb-toyota", bank: "metrobank-cc", name: "Toyota Platinum Mastercard", net: "mastercard", src: "Toyota_Platinum_Card_preview", erase: [[6, 76, 45, 91]] },
  { id: "mb-travel", bank: "metrobank-cc", name: "Travel Signature Visa", net: "visa", src: "Travel_Signature_Visa_preview", erase: [[2, 81, 32, 93]] },
  // RCBC
  { id: "rcbc-airmiles", bank: "rcbc-cc", name: "Airmiles Visa Signature", net: "visa", v: true, src: "RCBC-Airmiles-Visa-Signature.png_img", erase: [] },
  { id: "rcbc-world", bank: "rcbc-cc", name: "World Mastercard", net: "mastercard", src: "RCBC_World_Mastercard_2024", erase: [[4, 81, 48, 92]] },
  { id: "rcbc-airasia-plat", bank: "rcbc-cc", name: "AirAsia Platinum Visa", net: "visa", v: true, src: "AA-Platinum", erase: [] },
  { id: "rcbc-airasia", bank: "rcbc-cc", name: "AirAsia Visa", net: "visa", v: true, src: "AirAsia-Classic", erase: [] },
  { id: "rcbc-hexagon-priority", bank: "rcbc-cc", name: "Hexagon Club Priority", net: "mastercard", src: "HEXAGON-CLUB-PRIORITY", erase: [[5, 78, 62, 88]] },
  { id: "rcbc-jcb-gold", bank: "rcbc-cc", name: "Gold JCB", net: "jcb", src: "JCB_Gold_1_", erase: [[6, 78, 48, 87]] },
  { id: "rcbc-landmark", bank: "rcbc-cc", name: "Landmark Anson's Mastercard", net: "mastercard", src: "LA_MC_2", erase: [[10, 81, 46, 89]] },
  { id: "rcbc-classic-mc", bank: "rcbc-cc", name: "Classic Mastercard", net: "mastercard", src: "Mastercard_Classic_1_", erase: [[8, 78, 42, 86]] },
  { id: "rcbc-gold-mc", bank: "rcbc-cc", name: "Gold Mastercard", net: "mastercard", src: "RCBC_Gold_Credit_Card_Mastercard", erase: [[7, 81, 47, 90]] },
  { id: "rcbc-hexagon-privilege", bank: "rcbc-cc", name: "Hexagon Club Privilege", net: "mastercard", src: "RCBC_Hexagon_Club_2022", erase: [[12, 82, 52, 91]] },
  { id: "rcbc-zalora", bank: "rcbc-cc", name: "ZALORA Credit Card", net: "mastercard", src: "ZALORA-Credit-Card", erase: [[9, 74, 44, 83]] },
  { id: "rcbc-black", bank: "rcbc-cc", name: "Black Card Platinum Mastercard", net: "mastercard", src: "black-MC", erase: [[5, 76, 69, 85]] },
  { id: "rcbc-diamond", bank: "rcbc-cc", name: "Diamond Platinum Mastercard", net: "mastercard", src: "diamond-mastercard", erase: [[4, 85, 40, 94]] },
  { id: "rcbc-jcb-classic", bank: "rcbc-cc", name: "Classic JCB", net: "jcb", src: "jcb-classic", erase: [[8, 78, 48, 87]] },
  { id: "rcbc-ygc", bank: "rcbc-cc", name: "YGC Rewards Plus", net: "mastercard", src: "mc-black-ygc-2022", erase: [[9, 82, 57, 92]] },
  { id: "rcbc-infinite", bank: "rcbc-cc", name: "Visa Infinite", net: "visa", src: "visa-infinite.png_Visa_Infinite_Discover", erase: [[9, 80, 51, 89]] },
  { id: "rcbc-infinite-dollar", bank: "rcbc-cc", name: "Visa Infinite Dollar", net: "visa", src: "visa-infinite_dollar", erase: [[9, 80, 51, 89]] },
  { id: "rcbc-jcb-plat", bank: "rcbc-cc", name: "JCB Platinum", net: "jcb", src: "RCBC_jcb-plat", erase: [[5, 74, 50, 86, "c", 22]] },
  // UnionBank (second batch, folder creditcards2)
  { id: "ub-cashback", bank: "unionbank-cc", name: "Cash Back Mastercard", net: "mastercard", src: "2023-UB-Card-Cash-Back", full: true, erase: [] },
  { id: "ub-miles", bank: "unionbank-cc", name: "Miles+ Mastercard", net: "mastercard", src: "2023-UB-Card-Miles", full: true, erase: [] },
  { id: "ub-platinum", bank: "unionbank-cc", name: "Platinum Mastercard", net: "mastercard", src: "2023-UB-Card-Platinum", full: true, erase: [[4, 77, 60, 89, "h"]] },
  { id: "ub-reserve", bank: "unionbank-cc", name: "Reserve Mastercard", net: "mastercard", src: "2023-UB-Card-Reserve", full: true, erase: [] },
  { id: "ub-rewards-mc", bank: "unionbank-cc", name: "Rewards Mastercard", net: "mastercard", src: "2023-UB-Card-Rewards", full: true, erase: [] },
  { id: "ub-rewards-visa", bank: "unionbank-cc", name: "Rewards Visa Platinum", net: "visa", src: "featured-rewards", erase: [] },
  { id: "ub-cebpac-gold", bank: "unionbank-cc", name: "Cebu Pacific Gold Visa", net: "visa", src: "Ceb-Credit-Card-Gold", erase: [[1, 59, 99, 73, "h"], [1, 73, 70, 94]] },
  { id: "ub-cebpac-plat", bank: "unionbank-cc", name: "Cebu Pacific Platinum Visa", net: "visa", src: "Ceb-Credit-Card-Plat", erase: [[1, 59, 99, 73, "h"], [1, 73, 70, 94]] },
  { id: "ub-gorewards-gold", bank: "unionbank-cc", name: "GoRewards Gold Visa", net: "visa", src: "Go-Rewards-Gold", erase: [[1, 57, 99, 73, "h"], [1, 73, 62, 92]] },
  { id: "ub-gorewards-plat", bank: "unionbank-cc", name: "GoRewards Platinum Visa", net: "visa", src: "Go-Rewards-Plat", erase: [[1, 57, 99, 73, "h"], [1, 73, 62, 92]] },
  { id: "ub-playeveryday", bank: "unionbank-cc", name: "PlayEveryday Visa", net: "visa", src: "PlayEveryday-Credit", erase: [[1, 57, 92, 71, "h"], [0, 71, 68, 94]] },
  { id: "ub-snr", bank: "unionbank-cc", name: "S&R Visa Platinum", net: "visa", src: "UB-SnR-Card", erase: [] },
  { id: "ub-lazada", bank: "unionbank-cc", name: "Lazada Mastercard", net: "mastercard", src: "lazada-card", erase: [[4, 81, 42, 90]] },
  { id: "ub-mercury", bank: "unionbank-cc", name: "Mercury Visa", net: "visa", v: true, src: "mercury-visa", erase: [] },
  { id: "ub-u", bank: "unionbank-cc", name: "U Mastercard", net: "mastercard", v: true, src: "ucard-mc", tol: 12, erase: [] },
  // Maya (Maya Credit card)
  { id: "maya-visa-plat", bank: "mayacredit", name: "Maya Black Visa Platinum", net: "visa", src: "maya-black", full: true, erase: [] },
  { id: "maya-landers", bank: "mayacredit", name: "Landers Maya Visa Platinum", net: "visa", src: "landers-maya-visa-platinum", erase: [[4, 80, 46, 91]] },
  // PNB (second batch, folder creditcards2)
  { id: "pnb-icaaa", bank: "pnb-cc", name: "ICAAA Platinum Mastercard", net: "mastercard", src: "1C25nTj5fPpmP1fZppXgAK4GjS7pDdu0GNAFmeWr", erase: [[2, 55, 90, 66, "h"], [2, 66, 70, 95]] },
  { id: "pnb-pal-world", bank: "pnb-cc", name: "PAL Mabuhay Miles World Mastercard", net: "mastercard", src: "3HL3u0T6Gnrpvx0YJ3ZWOEFJNdG3GkQ8u39BYwLC", erase: [[2, 56, 90, 70, "h"], [2, 70, 68, 94]] },
  { id: "pnb-aaxs", bank: "pnb-cc", name: "AAXS Platinum Mastercard", net: "mastercard", src: "HNd2UuAJ5eecHaxocdh06hQ6y71vFfvCiQmq9yUt", erase: [[2, 56, 90, 70, "h"], [2, 70, 68, 94]] },
  { id: "pnb-cashback", bank: "pnb-cc", name: "Cash Back Platinum Mastercard", net: "mastercard", v: true, src: "HOgDMr2Kk0JNDI5m51uxlpNwJ6PuTjwuQMkxBEVZ", erase: [] },
  { id: "pnb-platinum", bank: "pnb-cc", name: "Platinum Mastercard", net: "mastercard", src: "Hx0lO0mHvFzKYUckjMujWEm6kg12LEJf0xAPB5sA", erase: [[2, 57, 90, 70, "h"], [2, 70, 68, 94]] },
  { id: "pnb-pal-plat", bank: "pnb-cc", name: "PAL Mabuhay Miles Platinum Mastercard", net: "mastercard", src: "P8Gah0NDByXNbHS99WohRJ5NU3akapACUsIjgqHX", erase: [[2, 56, 90, 70, "h"], [2, 70, 68, 94]] },
  { id: "pnb-cart", bank: "pnb-cc", name: "Cart Mastercard", net: "mastercard", src: "PZo7WyfQJDO1ybQDFiBzUXrEHUkMKu7uyXXyBc68", erase: [[3, 68, 66, 93]] },
  { id: "pnb-jcb-plat", bank: "pnb-cc", name: "JCB Platinum", net: "jcb", src: "UkJKkeWUBpzcllbnf5vYCyboiRzTut1cDpWAiagI", erase: [] },
  { id: "pnb-visa-gold", bank: "pnb-cc", name: "Gold Visa", net: "visa", src: "Y6p5yiGU5P0p3A2obLWOpf62CqaN96ZTzDlcPgcA", erase: [[2, 55, 82, 69, "h"], [2, 69, 68, 93]] },
  { id: "pnb-travelclub", bank: "pnb-cc", name: "The Travel Club Platinum Mastercard", net: "mastercard", src: "pyQUj8DCrXgn7PneT4Al6D8xwhz5exUnv922a4ju", erase: [[2, 55, 84, 69, "h"], [2, 69, 68, 93]] },
  { id: "pnb-essentials", bank: "pnb-cc", name: "Essentials Mastercard", net: "mastercard", src: "q71Mm4bbaj6yFOjnjToNXSMa4tXOeyYvDIFSrEM9", erase: [[2, 55, 84, 69, "h"], [2, 69, 68, 93]] },
];
