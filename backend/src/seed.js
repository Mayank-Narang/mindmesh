const User = require('./models/User');
const Brain = require('./models/Brain');
const Note = require('./models/Note');

async function seedDemoUser() {
  try {
    const email = 'demo@mindmesh.io';
    const password = 'DemoPassword123!';
    
    const existingUser = await User.findOne({ email });
    if (existingUser) return; // Already seeded
    
    console.log("Seeding Demo User and initial data...");
    
    const demoUser = new User({
      name: 'Demo User',
      email,
      password
    });
    await demoUser.save();

    // Create brains
    const b1 = new Brain({ name: 'Personal', icon: '🧠', color: '#22d3ee', userId: demoUser._id });
    const b2 = new Brain({ name: 'Work', icon: '💼', color: '#8b5cf6', userId: demoUser._id });
    const b3 = new Brain({ name: 'Research', icon: '🔬', color: '#34d399', userId: demoUser._id });
    
    await Brain.insertMany([b1, b2, b3]);

    // Create notes
    const n1 = new Note({
      title: 'Linux Screen Brightness Fix',
      content: `# Fixing Screen Brightness on Arch Linux\n\nThe backlight controls stopped working after a kernel update.\n\n## Solution\n\nEdit the GRUB config and add the \`acpi_backlight=native\` parameter:\n\n\`\`\`bash\nsudo nano /etc/default/grub\nGRUB_CMDLINE_LINUX_DEFAULT="quiet acpi_backlight=native"\nsudo grub-mkconfig -o /boot/grub/grub.cfg\n\`\`\`\n\n> Reboot required after this change.\n\n### Alternative\nUse **brightnessctl** for manual control:\n- \`brightnessctl set 50%\`\n- \`brightnessctl set +10%\``,
      type: 'markdown',
      tags: ['linux', 'hardware'],
      brainId: b1._id,
      userId: demoUser._id
    });
    
    const n2 = new Note({
      title: 'JWT Auth Architecture Notes',
      content: `# JWT Flow\n\n1. User sends credentials.\n2. Server verifies and issues token with \`{ id, role }\` payload.\n3. Client stores token (localStorage/cookie).\n4. Client sends token in \`Authorization: Bearer <token>\` header for protected routes.\n5. Server verifies signature using secret key.\n\n**Important**: Keep expiry short and implement refresh tokens for better security!`,
      type: 'markdown',
      tags: ['auth', 'security'],
      brainId: b2._id,
      userId: demoUser._id
    });

    const n3 = new Note({
      title: 'Project Ideas 2026',
      content: '1. Autonomous multi-agent coding system\n2. Semantic knowledge graph for personal notes\n3. Local-first vector database for edge devices',
      type: 'text',
      tags: ['ideas', 'projects'],
      brainId: b1._id,
      userId: demoUser._id
    });

    await Note.insertMany([n1, n2, n3]);
    console.log("✅ Demo User seeded successfully in MongoDB!");
  } catch (err) {
    console.error("Failed to seed demo user:", err);
  }
}

module.exports = seedDemoUser;
