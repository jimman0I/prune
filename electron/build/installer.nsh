; The installer's "Updates" page and language dialog, and what they hand
; to the app.
;
; Two questions, two different lifetimes. Neither can go into
; settings.json directly -- NSIS has no JSON, and would have to merge
; into a file it cannot read -- so the installer leaves a one-line file,
; installer-choices.json, beside it, and the app applies it on its next
; start and deletes it (backend/src/services/installerChoices.js).
;
; "Should Prune check for updates?" is asked on a fresh install only.
; Anyone who has used Prune on this Windows account already has a
; settings.json, and their choice lives there; an unticked box on a
; reinstall would otherwise quietly turn off an update check they had
; turned on. So the page skips itself, and updateCheck is left out of
; the file entirely -- change it in Settings instead.
;
; The installer's own display language, by contrast, is written on
; EVERY interactive install, fresh or upgrade: it is a real, deliberate
; choice the person just made in the wizard's own language dialog, not
; a leftover default, and the app opening in whatever language the
; installer just ran in is the whole point of shipping one. See
; customInstall below for why this is no longer tied to the same
; fresh-install-only gate updateCheck uses.
;
; Never during a silent install, which is what the updater runs: no page
; is shown, no dialog appears, and no file is written at all, so an
; update never touches either choice.
;
; Off unless ticked, as it is in the app: the check is the one request
; Prune makes beyond the machine, and it is opt-in everywhere.
;
; The page's words are below in every installer language.
; electron/installerLanguages.test.cjs fails if a language the installer
; offers has no translation here.

!ifndef BUILD_UNINSTALLER

!macro customHeader
  !include nsDialogs.nsh
  !include LogicLib.nsh

  Var updatesCheckbox
  Var updatesChoice

  ; The language this install picked, as one of languages.js's 40 short
  ; codes rather than NSIS's own LANG_* id -- written to
  ; installer-choices.json in customInstall below, alongside updateCheck,
  ; so the app opens in the same language the installer just ran in.
  ; $(appLangCode) resolves against $LANGUAGE at the point it is used,
  ; same as any other LangString reference, so no separate capture is
  ; needed. backend/src/services/installerChoices.js ignores any code it
  ; does not recognise, so a mismatch here fails safe rather than corrupt.
  LangString appLangCode ${LANG_ENGLISH} "en"
  LangString appLangCode ${LANG_AFRIKAANS} "af"
  LangString appLangCode ${LANG_ARABIC} "ar"
  LangString appLangCode ${LANG_CATALAN} "ca"
  LangString appLangCode ${LANG_CZECH} "cs"
  LangString appLangCode ${LANG_WELSH} "cy"
  LangString appLangCode ${LANG_DANISH} "da"
  LangString appLangCode ${LANG_GERMAN} "de"
  LangString appLangCode ${LANG_GREEK} "el"
  LangString appLangCode ${LANG_SPANISHINTERNATIONAL} "es"
  LangString appLangCode ${LANG_ESTONIAN} "et"
  LangString appLangCode ${LANG_FINNISH} "fi"
  LangString appLangCode ${LANG_FRENCH} "fr"
  LangString appLangCode ${LANG_HEBREW} "he"
  LangString appLangCode ${LANG_HUNGARIAN} "hu"
  LangString appLangCode ${LANG_INDONESIAN} "id"
  LangString appLangCode ${LANG_ICELANDIC} "is"
  LangString appLangCode ${LANG_ITALIAN} "it"
  LangString appLangCode ${LANG_JAPANESE} "ja"
  LangString appLangCode ${LANG_KOREAN} "ko"
  LangString appLangCode ${LANG_LITHUANIAN} "lt"
  LangString appLangCode ${LANG_MALAY} "ms"
  LangString appLangCode ${LANG_NORWEGIAN} "nb"
  LangString appLangCode ${LANG_DUTCH} "nl"
  LangString appLangCode ${LANG_POLISH} "pl"
  LangString appLangCode ${LANG_PASHTO} "ps"
  LangString appLangCode ${LANG_PORTUGUESEBR} "pt-BR"
  LangString appLangCode ${LANG_PORTUGUESE} "pt"
  LangString appLangCode ${LANG_ROMANIAN} "ro"
  LangString appLangCode ${LANG_RUSSIAN} "ru"
  LangString appLangCode ${LANG_SLOVAK} "sk"
  LangString appLangCode ${LANG_ALBANIAN} "sq"
  LangString appLangCode ${LANG_SERBIAN} "sr"
  LangString appLangCode ${LANG_SWEDISH} "sv"
  LangString appLangCode ${LANG_THAI} "th"
  LangString appLangCode ${LANG_TURKISH} "tr"
  LangString appLangCode ${LANG_UKRAINIAN} "uk"
  LangString appLangCode ${LANG_VIETNAMESE} "vi"
  LangString appLangCode ${LANG_SIMPCHINESE} "zh-CN"
  LangString appLangCode ${LANG_TRADCHINESE} "zh-TW"

  LangString updatesTitle ${LANG_ENGLISH} "Updates"
  LangString updatesSubtitle ${LANG_ENGLISH} "Prune can let you know when a new version is out."
  LangString updatesCheckbox ${LANG_ENGLISH} "Check for updates once a day (you can change this later in Prune's settings)"

  LangString updatesTitle ${LANG_AFRIKAANS} "Opdaterings"
  LangString updatesSubtitle ${LANG_AFRIKAANS} "Prune kan jou laat weet wanneer ’n nuwe weergawe uitkom."
  LangString updatesCheckbox ${LANG_AFRIKAANS} "Kyk een keer per dag vir opdaterings (jy kan dit later in Prune se instellings verander)"

  LangString updatesTitle ${LANG_ARABIC} "التحديثات"
  LangString updatesSubtitle ${LANG_ARABIC} "يمكن لـ Prune إعلامك عند صدور إصدار جديد."
  LangString updatesCheckbox ${LANG_ARABIC} "التحقق من وجود تحديثات مرة واحدة يوميًا (يمكنك تغيير ذلك لاحقًا من إعدادات Prune)"

  LangString updatesTitle ${LANG_CATALAN} "Actualitzacions"
  LangString updatesSubtitle ${LANG_CATALAN} "Prune et pot avisar quan surti una versió nova."
  LangString updatesCheckbox ${LANG_CATALAN} "Cerca actualitzacions un cop al dia (ho pots canviar més endavant a la configuració de Prune)"

  LangString updatesTitle ${LANG_CZECH} "Aktualizace"
  LangString updatesSubtitle ${LANG_CZECH} "Prune vám může dát vědět, když vyjde nová verze."
  LangString updatesCheckbox ${LANG_CZECH} "Jednou denně kontrolovat aktualizace (později to můžete změnit v nastavení Prune)"

  LangString updatesTitle ${LANG_WELSH} "Diweddariadau"
  LangString updatesSubtitle ${LANG_WELSH} "Gall Prune roi gwybod i chi pan fydd fersiwn newydd ar gael."
  LangString updatesCheckbox ${LANG_WELSH} "Gwirio am ddiweddariadau unwaith y dydd (gallwch newid hyn yn nes ymlaen yng ngosodiadau Prune)"

  LangString updatesTitle ${LANG_DANISH} "Opdateringer"
  LangString updatesSubtitle ${LANG_DANISH} "Prune kan give dig besked, når der kommer en ny version."
  LangString updatesCheckbox ${LANG_DANISH} "Søg efter opdateringer én gang om dagen (du kan ændre det senere i Prunes indstillinger)"

  LangString updatesTitle ${LANG_GERMAN} "Updates"
  LangString updatesSubtitle ${LANG_GERMAN} "Prune kann Ihnen mitteilen, wenn eine neue Version erscheint."
  LangString updatesCheckbox ${LANG_GERMAN} "Einmal täglich nach Updates suchen (später in den Einstellungen von Prune änderbar)"

  LangString updatesTitle ${LANG_GREEK} "Ενημερώσεις"
  LangString updatesSubtitle ${LANG_GREEK} "Το Prune μπορεί να σας ειδοποιεί όταν κυκλοφορεί νέα έκδοση."
  LangString updatesCheckbox ${LANG_GREEK} "Έλεγχος για ενημερώσεις μία φορά την ημέρα (μπορείτε να το αλλάξετε αργότερα στις ρυθμίσεις του Prune)"

  LangString updatesTitle ${LANG_SPANISHINTERNATIONAL} "Actualizaciones"
  LangString updatesSubtitle ${LANG_SPANISHINTERNATIONAL} "Prune puede avisarte cuando salga una versión nueva."
  LangString updatesCheckbox ${LANG_SPANISHINTERNATIONAL} "Buscar actualizaciones una vez al día (puedes cambiarlo más tarde en la configuración de Prune)"

  LangString updatesTitle ${LANG_ESTONIAN} "Uuendused"
  LangString updatesSubtitle ${LANG_ESTONIAN} "Prune saab sulle teada anda, kui ilmub uus versioon."
  LangString updatesCheckbox ${LANG_ESTONIAN} "Kontrolli uuendusi kord päevas (saad seda hiljem Prune'i seadetes muuta)"

  LangString updatesTitle ${LANG_FINNISH} "Päivitykset"
  LangString updatesSubtitle ${LANG_FINNISH} "Prune voi kertoa sinulle, kun uusi versio julkaistaan."
  LangString updatesCheckbox ${LANG_FINNISH} "Tarkista päivitykset kerran päivässä (voit muuttaa tätä myöhemmin Prunen asetuksista)"

  LangString updatesTitle ${LANG_FRENCH} "Mises à jour"
  LangString updatesSubtitle ${LANG_FRENCH} "Prune peut vous prévenir lorsqu’une nouvelle version sort."
  LangString updatesCheckbox ${LANG_FRENCH} "Rechercher les mises à jour une fois par jour (modifiable plus tard dans les paramètres de Prune)"

  LangString updatesTitle ${LANG_HEBREW} "עדכונים"
  LangString updatesSubtitle ${LANG_HEBREW} "Prune יכולה להודיע לך כשיוצאת גרסה חדשה."
  LangString updatesCheckbox ${LANG_HEBREW} "בדיקת עדכונים פעם ביום (אפשר לשנות זאת מאוחר יותר בהגדרות של Prune)"

  LangString updatesTitle ${LANG_HUNGARIAN} "Frissítések"
  LangString updatesSubtitle ${LANG_HUNGARIAN} "A Prune értesíthet, ha új verzió jelenik meg."
  LangString updatesCheckbox ${LANG_HUNGARIAN} "Frissítések keresése naponta egyszer (később a Prune beállításaiban módosítható)"

  LangString updatesTitle ${LANG_INDONESIAN} "Pembaruan"
  LangString updatesSubtitle ${LANG_INDONESIAN} "Prune dapat memberi tahu Anda saat versi baru dirilis."
  LangString updatesCheckbox ${LANG_INDONESIAN} "Periksa pembaruan sekali sehari (Anda dapat mengubahnya nanti di pengaturan Prune)"

  LangString updatesTitle ${LANG_ICELANDIC} "Uppfærslur"
  LangString updatesSubtitle ${LANG_ICELANDIC} "Prune getur látið þig vita þegar ný útgáfa kemur út."
  LangString updatesCheckbox ${LANG_ICELANDIC} "Leita að uppfærslum einu sinni á dag (þú getur breytt þessu síðar í stillingum Prune)"

  LangString updatesTitle ${LANG_ITALIAN} "Aggiornamenti"
  LangString updatesSubtitle ${LANG_ITALIAN} "Prune può avvisarti quando esce una nuova versione."
  LangString updatesCheckbox ${LANG_ITALIAN} "Controlla gli aggiornamenti una volta al giorno (puoi cambiarlo in seguito nelle impostazioni di Prune)"

  LangString updatesTitle ${LANG_JAPANESE} "更新"
  LangString updatesSubtitle ${LANG_JAPANESE} "新しいバージョンが出たときに Prune がお知らせします。"
  LangString updatesCheckbox ${LANG_JAPANESE} "1 日 1 回、更新を確認する（あとで Prune の設定から変更できます）"

  LangString updatesTitle ${LANG_KOREAN} "업데이트"
  LangString updatesSubtitle ${LANG_KOREAN} "새 버전이 나오면 Prune이 알려 드릴 수 있습니다."
  LangString updatesCheckbox ${LANG_KOREAN} "하루에 한 번 업데이트 확인 (나중에 Prune 설정에서 변경할 수 있습니다)"

  LangString updatesTitle ${LANG_LITHUANIAN} "Atnaujinimai"
  LangString updatesSubtitle ${LANG_LITHUANIAN} "Prune gali jums pranešti, kai išleidžiama nauja versija."
  LangString updatesCheckbox ${LANG_LITHUANIAN} "Kartą per dieną tikrinti, ar yra atnaujinimų (vėliau tai galite pakeisti Prune nustatymuose)"

  LangString updatesTitle ${LANG_MALAY} "Kemas kini"
  LangString updatesSubtitle ${LANG_MALAY} "Prune boleh memberitahu anda apabila versi baharu dikeluarkan."
  LangString updatesCheckbox ${LANG_MALAY} "Semak kemas kini sekali sehari (anda boleh menukarnya kemudian dalam tetapan Prune)"

  LangString updatesTitle ${LANG_DUTCH} "Updates"
  LangString updatesSubtitle ${LANG_DUTCH} "Prune kan je laten weten wanneer er een nieuwe versie is."
  LangString updatesCheckbox ${LANG_DUTCH} "Eén keer per dag op updates controleren (je kunt dit later wijzigen in de instellingen van Prune)"

  LangString updatesTitle ${LANG_NORWEGIAN} "Oppdateringer"
  LangString updatesSubtitle ${LANG_NORWEGIAN} "Prune kan gi deg beskjed når en ny versjon kommer."
  LangString updatesCheckbox ${LANG_NORWEGIAN} "Se etter oppdateringer én gang om dagen (du kan endre dette senere i innstillingene til Prune)"

  LangString updatesTitle ${LANG_POLISH} "Aktualizacje"
  LangString updatesSubtitle ${LANG_POLISH} "Prune może Cię powiadomić, gdy pojawi się nowa wersja."
  LangString updatesCheckbox ${LANG_POLISH} "Sprawdzaj aktualizacje raz dziennie (możesz to później zmienić w ustawieniach Prune)"

  LangString updatesTitle ${LANG_PASHTO} "تازه کول"
  LangString updatesSubtitle ${LANG_PASHTO} "Prune کولی شي تاسو ته خبر درکړي کله چې نوې نسخه راووځي."
  LangString updatesCheckbox ${LANG_PASHTO} "په ورځ کې یو ځل د تازه کولو لپاره وګورئ (وروسته یې د Prune په ترتیباتو کې بدلولی شئ)"

  LangString updatesTitle ${LANG_PORTUGUESEBR} "Atualizações"
  LangString updatesSubtitle ${LANG_PORTUGUESEBR} "O Prune pode avisar você quando sair uma nova versão."
  LangString updatesCheckbox ${LANG_PORTUGUESEBR} "Verificar atualizações uma vez por dia (você pode mudar isso depois nas configurações do Prune)"

  LangString updatesTitle ${LANG_PORTUGUESE} "Atualizações"
  LangString updatesSubtitle ${LANG_PORTUGUESE} "O Prune pode avisá-lo quando sair uma nova versão."
  LangString updatesCheckbox ${LANG_PORTUGUESE} "Procurar atualizações uma vez por dia (pode alterar isto mais tarde nas definições do Prune)"

  LangString updatesTitle ${LANG_ROMANIAN} "Actualizări"
  LangString updatesSubtitle ${LANG_ROMANIAN} "Prune vă poate anunța când apare o versiune nouă."
  LangString updatesCheckbox ${LANG_ROMANIAN} "Caută actualizări o dată pe zi (puteți schimba asta mai târziu din setările Prune)"

  LangString updatesTitle ${LANG_RUSSIAN} "Обновления"
  LangString updatesSubtitle ${LANG_RUSSIAN} "Prune может сообщать вам о выходе новой версии."
  LangString updatesCheckbox ${LANG_RUSSIAN} "Проверять обновления раз в день (это можно изменить позже в настройках Prune)"

  LangString updatesTitle ${LANG_SLOVAK} "Aktualizácie"
  LangString updatesSubtitle ${LANG_SLOVAK} "Prune vám môže dať vedieť, keď vyjde nová verzia."
  LangString updatesCheckbox ${LANG_SLOVAK} "Raz denne kontrolovať aktualizácie (neskôr to môžete zmeniť v nastaveniach Prune)"

  LangString updatesTitle ${LANG_ALBANIAN} "Përditësime"
  LangString updatesSubtitle ${LANG_ALBANIAN} "Prune mund t’ju njoftojë kur del një version i ri."
  LangString updatesCheckbox ${LANG_ALBANIAN} "Kontrollo për përditësime një herë në ditë (mund ta ndryshoni më vonë te cilësimet e Prune)"

  LangString updatesTitle ${LANG_SERBIAN} "Ажурирања"
  LangString updatesSubtitle ${LANG_SERBIAN} "Prune може да вас обавести када изађе нова верзија."
  LangString updatesCheckbox ${LANG_SERBIAN} "Проверавај ажурирања једном дневно (касније то можете да промените у подешавањима програма Prune)"

  LangString updatesTitle ${LANG_SWEDISH} "Uppdateringar"
  LangString updatesSubtitle ${LANG_SWEDISH} "Prune kan meddela dig när en ny version kommer ut."
  LangString updatesCheckbox ${LANG_SWEDISH} "Sök efter uppdateringar en gång om dagen (du kan ändra detta senare i Prunes inställningar)"

  LangString updatesTitle ${LANG_THAI} "การอัปเดต"
  LangString updatesSubtitle ${LANG_THAI} "Prune แจ้งให้คุณทราบได้เมื่อมีเวอร์ชันใหม่"
  LangString updatesCheckbox ${LANG_THAI} "ตรวจหาการอัปเดตวันละครั้ง (คุณเปลี่ยนได้ภายหลังในการตั้งค่าของ Prune)"

  LangString updatesTitle ${LANG_TURKISH} "Güncellemeler"
  LangString updatesSubtitle ${LANG_TURKISH} "Prune yeni bir sürüm çıktığında size haber verebilir."
  LangString updatesCheckbox ${LANG_TURKISH} "Güncellemeleri günde bir kez denetle (bunu daha sonra Prune ayarlarından değiştirebilirsiniz)"

  LangString updatesTitle ${LANG_UKRAINIAN} "Оновлення"
  LangString updatesSubtitle ${LANG_UKRAINIAN} "Prune може повідомляти вас про вихід нової версії."
  LangString updatesCheckbox ${LANG_UKRAINIAN} "Перевіряти оновлення раз на день (це можна змінити пізніше в налаштуваннях Prune)"

  LangString updatesTitle ${LANG_VIETNAMESE} "Cập nhật"
  LangString updatesSubtitle ${LANG_VIETNAMESE} "Prune có thể báo cho bạn khi có phiên bản mới."
  LangString updatesCheckbox ${LANG_VIETNAMESE} "Kiểm tra cập nhật mỗi ngày một lần (bạn có thể thay đổi sau trong phần cài đặt của Prune)"

  LangString updatesTitle ${LANG_SIMPCHINESE} "更新"
  LangString updatesSubtitle ${LANG_SIMPCHINESE} "有新版本时，Prune 可以通知你。"
  LangString updatesCheckbox ${LANG_SIMPCHINESE} "每天检查一次更新（之后可在 Prune 的设置中更改）"

  LangString updatesTitle ${LANG_TRADCHINESE} "更新"
  LangString updatesSubtitle ${LANG_TRADCHINESE} "有新版本時，Prune 可以通知你。"
  LangString updatesCheckbox ${LANG_TRADCHINESE} "每天檢查一次更新（之後可在 Prune 的設定中變更）"

  Function updatesPageCreate
    ; Asked on a fresh install only -- see the top of this file.
    ${If} ${FileExists} "$APPDATA\Prune\settings.json"
      Abort
    ${EndIf}

    !insertmacro MUI_HEADER_TEXT "$(updatesTitle)" "$(updatesSubtitle)"
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 30u "$(updatesCheckbox)"
    Pop $updatesCheckbox
    ${NSD_Uncheck} $updatesCheckbox

    nsDialogs::Show
  FunctionEnd

  Function updatesPageLeave
    ${NSD_GetState} $updatesCheckbox $0
    ${If} $0 == ${BST_CHECKED}
      StrCpy $updatesChoice "true"
    ${Else}
      StrCpy $updatesChoice "false"
    ${EndIf}
  FunctionEnd
!macroend

!macro customPageAfterChangeDir
  Page custom updatesPageCreate updatesPageLeave
!macroend

!macro customInstall
  ; The language is written on every interactive install, fresh or
  ; upgrade -- ${Silent} is the updater's own install, which shows no
  ; pages (including the language dialog) at all, so it is excluded the
  ; same way updateCheck already was.
  ;
  ; This used to be gated on $updatesChoice too (empty on an upgrade,
  ; since the Updates page skips itself there -- see updatesPageCreate).
  ; The reasoning was that a reinstall in whatever language Windows
  ; happens to default to should not silently override a language
  ; someone had deliberately picked inside Prune's own Settings. In
  ; practice that protected a rare case at the cost of the common one:
  ; someone upgrading Prune who ACTIVELY picks a language in the
  ; installer's own language dialog -- a real, deliberate choice, shown
  ; on every non-silent run regardless of fresh-install-or-not -- had it
  ; silently discarded, and the app opened in whatever language it was
  ; already in. Reported directly: an upgrade picked Greek in the
  ; installer and the app came up in English. $updatesChoice's own
  ; fresh-install-only gate is unrelated and unchanged -- that one
  ; protects against an unticked checkbox on a page nobody was shown
  ; turning off a setting silently, which is a real risk this decoupling
  ; does not touch.
  ${IfNot} ${Silent}
    CreateDirectory "$APPDATA\Prune"
    FileOpen $0 "$APPDATA\Prune\installer-choices.json" w
    ${If} $updatesChoice != ""
      FileWrite $0 '{"updateCheck":$updatesChoice,"language":"$(appLangCode)"}'
    ${Else}
      FileWrite $0 '{"language":"$(appLangCode)"}'
    ${EndIf}
    FileClose $0
  ${EndIf}
!macroend

!endif
