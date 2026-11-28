/* aquanode-messages: what travels between the phone and AquaNode (ICD 4.3, 4.4): HTTP over the Wi-Fi access
 * point, and JSON lines over Bluetooth serial. Same JSON on both links (JsonProtocol). Lesson 3.1.5. */
window.ESP32TOUR_DIAGRAMS = window.ESP32TOUR_DIAGRAMS || {};
ESP32TOUR_DIAGRAMS['aquanode-messages'] = function (D) {
  D.size(940, 430);
  D.minWidth(700);
  const I = (en, fr) => ({ en, fr });
  const L = 190, R = 750;                                       // arrow ends: phone side, AquaNode side

  D.box(20, 30, 150, 380, { title: I('Phone', 'Téléphone'), sub: I('app or browser', 'appli ou navigateur'),
    info: I('The Android app (MIT App Inventor) or any phone browser. It only shows and asks: AquaNode decides and keeps running without it.',
      'L’appli Android (MIT App Inventor) ou n’importe quel navigateur. Le téléphone ne fait qu’afficher et demander : AquaNode décide et continue sans lui.') });
  D.box(770, 30, 150, 380, { title: 'AquaNode', sub: I('ESP32 firmware', 'firmware ESP32'),
    info: I('The ESP32 firmware. One module (JsonProtocol) builds every status line and checks every command, for all the links.',
      'Le firmware de l’ESP32. Un seul module (JsonProtocol) construit chaque ligne d’état et vérifie chaque commande, pour tous les liens.') });

  // ---- lane 1: Wi-Fi access point + HTTP
  D.text(480, 48, I('Wi-Fi access point AQUA-NODE · 192.168.4.1 · HTTP', 'Point d’accès Wi-Fi AQUA-NODE · 192.168.4.1 · HTTP'), { anchor: 'middle', weight: 700, size: 15 });
  const req = (y, label, info) => { D.arrow([[L, y], [R, y]], { cls: 'data', info, title: label }); D.text(480, y - 12, label, { anchor: 'middle', size: 13, cls: 'dg-mono' }); };
  const rep = (y, label, info) => { D.arrow([[R, y], [L, y]], { cls: 'sig', dash: true, info, title: label }); D.text(480, y - 12, label, { anchor: 'middle', size: 13, cls: 'dg-mono' }); };
  req(88, 'GET /', I('The phone browser asks for the dashboard page. AquaNode sends one small HTML file (under 30 KB).', 'Le navigateur demande la page du tableau de bord. AquaNode envoie un petit fichier HTML (moins de 30 Ko).'));
  rep(118, I('dashboard page (HTML)', 'page du tableau de bord (HTML)'), I('The page then asks for the status every 2 s.', 'La page demande ensuite l’état toutes les 2 s.'));
  req(158, 'GET /api/status', I('Ask for the current status (polling).', 'Demander l’état actuel (interrogation).'));
  rep(188, '{"up":3600,"ph":6.82,…,"mode":"AUTO","alarm":""}', I('The status JSON: 11 fields, the same as on Bluetooth.', 'Le JSON d’état : 11 champs, les mêmes qu’en Bluetooth.'));
  req(228, 'POST /api/cmd  {"cmd":"set","pump":70}', I('A command, sent as the body of a POST request.', 'Une commande, envoyée comme corps d’une requête POST.'));
  rep(258, '{"ok":true}   or   {"ok":false,"err":"pump 0-100"}', I('Every command gets a reply: accepted, or refused with a short reason.', 'Chaque commande reçoit une réponse : acceptée, ou refusée avec une courte raison.'));

  // ---- lane 2: Bluetooth serial
  D.wire([[190, 290], [750, 290]], { cls: 'gnd', dash: true });
  D.text(480, 312, I('Classic Bluetooth serial (SPP) · AQUA-NODE · one JSON line per message', 'Bluetooth classique série (SPP) · AQUA-NODE · une ligne JSON par message'), { anchor: 'middle', weight: 700, size: 15 });
  rep(350, I('status line, every second, ends with \\n', 'ligne d’état, chaque seconde, finie par \\n'), I('AquaNode pushes the status by itself every second: the phone does not need to ask.', 'AquaNode envoie l’état de lui-même chaque seconde : le téléphone n’a pas besoin de demander.'));
  req(380, '{"cmd":"mode","value":"MANUAL"}\\n', I('A command is one line of JSON ending with a newline.', 'Une commande est une ligne de JSON finie par un retour à la ligne.'));
  rep(406, '{"ok":true}\\n', I('The reply, also one line.', 'La réponse, aussi en une ligne.'));
};
