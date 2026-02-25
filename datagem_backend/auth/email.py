import os
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail

def send_welcome_email(user_email, user_name):
    """Sends a welcome email to the newly registered user."""
    message = Mail(
        from_email='help.focusly@gmail.com',  # Replace with your verified sender email
        to_emails=user_email,
        subject='Welcome to DataGem! 💎',
        html_content=f'''
            <div style="font-family: sans-serif; max-width: 600px; margin: auto;">
                <h1 style="color: #4f46e5;">Welcome to DataGem, {user_name}!</h1>
                <p>We're thrilled to have you on board. Your AI Data Analyst is now ready to help you unlock insights from your datasets.</p>
                <div style="background: #f3f4f6; padding: 20px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="margin-top: 0;">What's Next?</h3>
                    <ul>
                        <li>Upload your first <strong>CSV dataset</strong></li>
                        <li>Ask questions in <strong>plain English</strong></li>
                        <li>Generate <strong>visualizations</strong> in seconds</li>
                    </ul>
                </div>
                <p>If you have any questions, just reply to this email.</p>
                <p>Happy analyzing!<br><strong>The DataGem Team</strong></p>
            </div>
        '''
    )
    try:
        sg = SendGridAPIClient(os.getenv('SENDGRID_API_KEY'))
        sg.send(message)
        print(f"✅ Welcome email sent to {user_email}")
    except Exception as e:
        print(f"❌ Failed to send email: {str(e)}")
