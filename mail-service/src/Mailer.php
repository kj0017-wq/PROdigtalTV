<?php

declare(strict_types=1);

namespace MailService;

use PHPMailer\PHPMailer\PHPMailer;

final class Mailer
{
    public function __construct(private Crypto $crypto)
    {
    }

    public function send(array $account, array $template, array $payload): array
    {
        $mail = new PHPMailer(true);
        $port = (int) ($account['smtpPort'] ?? 587);
        $variables = is_array($payload['variables'] ?? null) ? $payload['variables'] : [];
        $subject = $this->render((string) ($template['subject'] ?? ''), $variables);
        $textBody = $this->render((string) ($template['textBody'] ?? ''), $variables);
        $htmlBody = $this->render((string) ($template['htmlBody'] ?? ''), $variables);

        $mail->isSMTP();
        $mail->Host = (string) $account['smtpHost'];
        $mail->Port = $port;
        $mail->SMTPAuth = true;
        $mail->Username = (string) $account['smtpUser'];
        $mail->Password = $this->crypto->decrypt((string) $account['smtpPassEncrypted']);
        $mail->SMTPSecure = $port === 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;

        $mail->setFrom((string) $account['fromEmail'], (string) ($account['fromName'] ?? $account['fromEmail']));
        $mail->addAddress((string) $payload['to']);
        if (!empty($payload['replyTo'])) {
            $mail->addReplyTo((string) $payload['replyTo']);
        }
        $mail->Subject = $subject;
        if ($htmlBody !== '') {
            $mail->isHTML(true);
            $mail->Body = $htmlBody;
            $mail->AltBody = $textBody !== '' ? $textBody : strip_tags($htmlBody);
        } else {
            $mail->Body = $textBody;
        }
        $mail->send();
        return ['messageId' => $mail->getLastMessageID()];
    }

    private function render(string $template, array $variables): string
    {
        return preg_replace_callback('/{{\s*([a-zA-Z0-9_.-]+)\s*}}/', function (array $match) use ($variables) {
            $value = $variables[$match[1]] ?? '';
            return is_scalar($value) ? (string) $value : '';
        }, $template) ?? $template;
    }
}
