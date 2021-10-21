export interface SendHomeworkTemplateValues {
  applicantName: string;
  // deno-lint-ignore camelcase
  mk_signature: string;
  projectUrl: string;
  issueUrl: string;
  homeworkDueDate: Date;
}

export const sendHomeworkSubject = "sipgate Hausaufgabe";

export const sendHomeworkTemplate = (values: SendHomeworkTemplateValues) =>
  `<p>Hallo ${values.applicantName},</p><br />

  <p>vielen Dank für die Zusendung deines GitLab-Accounts.</p>

  <p>Du solltest bereits zwei Benachrichtigungen von GitLab erhalten haben. In dem <a href="${values.projectUrl}">GitLab-Repository</a>
  findest du in der README Datei die Hausaufgabe.
  Du hast für die Bearbeitung der Hausaufgabe erst einmal bis zum ${values.homeworkDueDate.getDate()}.${
    values
      .homeworkDueDate.getMonth() + 1
  }. Zeit.
  Falls es zeitlich zu dem Datum knapp werden sollte, melde dich bitte rechtzeitig bei uns - wir alle kennen solche stressigen Wochen!</p>

  <p>Klasse wäre es, wenn du uns an deinen Überlegungen beim Lösen der Hausaufgabe teilhaben lässt. Dafür kannst du die Funktionen von GitLab nutzen
  und mehrere Commits einstellen. Da es oft verschiedene Lösungswege gibt, können wir so die Entwicklung deiner Lösung besser verstehen.</p>

  <p>Falls du bisher keine oder nur wenige Erfahrungen mit dem Versionskontrollsystem Git hast, empfehlen wir dir die folgende Links anzusehen:
    <ul>
      <li><a href="https://www.freecodecamp.org/news/what-is-git-and-how-to-use-it-c341b049ae61/">An introduction to Git</a></li>
      <li><a href="https://git-scm.com/video/get-going">Get going with Git (Video)</a></li>
    </ul>
  </p>

  <p>Wenn du mit der Bearbeitung der Hausaufgabe fertig bist, beantworte bitte noch drei Fragen zu deiner Hausaufgabe. Diese findest du als Issue
  im selben Repository und unter dem Link <a href="${values.issueUrl}">hier</a>.
  Bitte schließe das Issue mit deiner Antwort, damit wir eine Benachrichtigung bekommen!</p>

  <p>Falls Du Fragen haben solltest, kannst du uns sehr gerne eine E-Mail schreiben. Telefonisch sind wir leider nur schlecht erreichbar.</p>

  <p>Der Zugang zum Repository läuft nach der Bearbeitungszeit automatisch ab. Das hat zur Folge, dass du ab diesem Zeitpunkt nicht länger pullen oder
  pushen kannst.
  Deine Lösung werden wir uns im Anschluss in jedem Fall anschauen. Im Anschluss melden wir uns bei dir.</p><br />
  <p>Viel Erfolg und viele Grüße,<br />
${values.mk_signature}</p>`;

export interface GitlabIssueTemplateValues {
  title: string;
  applicantName: string;
}

export const gitlabIssueTemplate = (values: GitlabIssueTemplateValues) => `
  Hallo ${values.applicantName},

  dieses Issue kannst du schließen, nachdem du die Hausaufgabe fertig bearbeitet hast. Bitte beantworte noch die folgenden drei Fragen zu deiner Hausaufgabe:

  1. Welchen Teil würdest du als größte Hürde beschreiben?
  2. Was gefällt dir an deiner Lösung am besten?
  3. Was könnte man noch verbessern?

  Nachdem du dieses Issue mit deinen Antworten geschlossen hast, bekommen wir eine Benachrichtigung. Wir schauen uns anschließend deine Lösung genau an und
  werden uns bei dir melden.
`;
