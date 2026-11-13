# KeshCut Booking Studio

Modify the existing KeshCut Studio website in the supplied project folder. The homepage is already built.
Preserve the existing design, layout, styling, animations, branding, and responsiveness. Do not redesign or rebuild the website.
1. Bookings
Replace the current WhatsApp-based booking submission with direct website bookings.
Save bookings in the database.
Allow customers to select services, dates, and available times, and enter their name and phone number.
Prevent duplicate or overlapping bookings.
Allow the admin to manage bookings.
After a customer creates their first booking ticket and receives their own session, allow them to change their selected services or add additional services through the website without creating a completely new customer session.
Ensure changes to services are reflected in the relevant booking ticket and visible to the admin in real time.
2. Customer identification
No customer accounts, passwords, or OTP.
Use the phone number as the primary customer identifier.
Create a secure, persistent session cookie when the customer's first ticket is created.
Use that session to recognize the customer on the same browser and device.
A new browser or device requires a new session.
Recognize returning customers through their existing session.
A phone number alone must never grant access to private bookings or conversations. Do not treat an unverified phone number as proof of ownership.
3. Customer messaging
Allow customers to start conversations and continue messaging directly on the website.
Messages should appear in real time without requiring a page refresh.
Customers must only see their own authorized conversations.
The admin must be able to view and reply to all customer conversations.
Chat must support text messages and emojis only. Do not allow image, video, audio, file, or other media sending.
4. Customer history
Store customer names, phone numbers, visit counts, previous bookings, services used, booking details, dates, and conversation history.
Allow the admin to search customers by phone number and view their complete history.
Prevent duplicate customer records caused by inconsistent phone-number formatting.
5. Admin management system
Provide a professional management system for handling bookings, incoming booking tickets, customers, and customer conversations.
Show new incoming bookings and relevant changes live on the page without requiring manual refreshes.
Keep booking statuses and management information updated in real time.
Make managing bookings and communicating with customers straightforward and organized.
Assign every booking ticket a unique ticket ID.
Allow the admin to search tickets using the customer's name, phone number, or unique ticket ID.
Display the ticket ID clearly in booking details.
6. Admin access
Create a private admin dashboard with the following authorized administrators:
Web Developer
Gmail: samundrakharel2020@gmail.com
Phone: 9769232638
Barbershop Owner / Manager
Gmail: keshcutstudio@gmail.com
Phone: To be provided later.
Only these authorized administrators should have access. Require the corresponding authorized Gmail address and phone number, and verify the Gmail address using an email OTP. Do not allow access through an unlisted email or phone number.
Enforce all admin authentication and permissions securely on the backend.
7. CAPTCHA
Do not use an external CAPTCHA provider.
Keep the CAPTCHA simple and implement its generation and validation entirely on the client side.
Do not add backend CAPTCHA processing.
8. Security
All security-sensitive operations must be validated and enforced on the backend.
This includes customer sessions and identity, booking ownership and availability, booking prices and status, message ownership and access, and admin permissions.
Never trust client-side data for authorization or sensitive decisions.
Protect customer information and conversations from unauthorized access.
Never expose privileged secrets or service keys in frontend code.
9. Database efficiency
Use the database as efficiently as possible.
Avoid unnecessary database operations, excessive requests, and inefficient data handling.
Keep the system responsive while handling bookings, customer history, and real-time messaging.
Manage database usage carefully without sacrificing functionality or data reliability.
10. Scalability
Design with a future target of 30,000–40,000 simultaneous website visitors and around 10,000 simultaneous customers using bookings and messaging.
Optimize database usage, connections, and real-time updates.
Do not assume free hosting or database plans can support this traffic. Identify relevant infrastructure limits and required upgrades.
Avoid unnecessary paid services.
11. Development efficiency
Minimize AI token and platform credit consumption throughout development.
Avoid unnecessary repeated analysis, explanations, file inspections, and code generation.
Inspect the project efficiently and reuse existing working code wherever possible.
Avoid repeating completed work or making unnecessary changes.
Use tools and resources efficiently while still completing and testing all requested functionality properly.
Prioritize efficient implementation without sacrificing quality, security, or reliability.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6a4e1356-87b0-4f91-9ac7-ef57943c9a5b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
