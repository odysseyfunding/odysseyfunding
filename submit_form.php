<?php
if ($_SERVER["REQUEST_METHOD"] == "POST") {
    $name = htmlspecialchars($_POST['name']);
    $email = htmlspecialchars($_POST['email']);
    $phone = htmlspecialchars($_POST['phone']);
    $business = htmlspecialchars($_POST['business']);
    $amount = htmlspecialchars($_POST['amount']);

    $to = "b.powers@merchant-financing.com";
    $subject = "New Funding Application from $name";
    $message = "Name: $name\nEmail: $email\nPhone: $phone\nBusiness: $business\nFunding Amount: $amount\n";

    $boundary = md5(time());
    $headers = "From: $email\r\n";
    $headers .= "MIME-Version: 1.0\r\n";
    $headers .= "Content-Type: multipart/mixed; boundary=\"$boundary\"\r\n";

    $body = "--$boundary\r\n";
    $body .= "Content-Type: text/plain; charset=UTF-8\r\n";
    $body .= "Content-Transfer-Encoding: 7bit\r\n\r\n";
    $body .= $message . "\r\n";

    if (!empty($_FILES['bank_statements']['name'][0])) {
        foreach ($_FILES['bank_statements']['tmp_name'] as $key => $tmp_name) {
            if ($_FILES['bank_statements']['error'][$key] === UPLOAD_ERR_OK) {
                $fileName = $_FILES['bank_statements']['name'][$key];
                $fileType = $_FILES['bank_statements']['type'][$key];
                $fileTmpName = $_FILES['bank_statements']['tmp_name'][$key];
                $fileContent = chunk_split(base64_encode(file_get_contents($fileTmpName)));

                $body .= "--$boundary\r\n";
                $body .= "Content-Type: $fileType; name=\"$fileName\"\r\n";
                $body .= "Content-Transfer-Encoding: base64\r\n";
                $body .= "Content-Disposition: attachment; filename=\"$fileName\"\r\n\r\n";
                $body .= $fileContent . "\r\n";
            }
        }
    }

    $body .= "--$boundary--";

    if (mail($to, $subject, $body, $headers)) {
        header('Location: thank_you.html');
        exit();
    } else {
        echo "Error in sending email.";
    }
}
?>
