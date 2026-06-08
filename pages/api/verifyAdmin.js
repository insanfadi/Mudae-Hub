export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body;
  
  // Use environment variable for the admin password, avoiding hardcoding in the repository
  const adminPassword = process.env.ADMIN_PASSWORD ;
  
  if (password === adminPassword) {
    return res.status(200).json({ success: true, isAdmin: true });
  }
  
  return res.status(401).json({ success: false, isAdmin: false });
}
