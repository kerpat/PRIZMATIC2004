// Test VK API - what data is available
// Paste this in browser console after VK login

async function testVKData(vkUserId, accessToken) {
    const tests = [
        {
            name: 'Basic Info',
            url: `https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=first_name,last_name,photo_200&access_token=${accessToken}&v=5.131`
        },
        {
            name: 'Extended Info',
            url: `https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=first_name,last_name,photo_200,city,bdate,country,home_town&access_token=${accessToken}&v=5.131`
        },
        {
            name: 'Contact Info (usually blocked)',
            url: `https://api.vk.com/method/users.get?user_ids=${vkUserId}&fields=contacts,phone&access_token=${accessToken}&v=5.131`
        }
    ];

    for (const test of tests) {
        console.log(`\n=== ${test.name} ===`);
        const response = await fetch(test.url);
        const data = await response.json();
        console.log(data);
    }
}

// Usage after VK login:
// testVKData('YOUR_VK_USER_ID', 'YOUR_ACCESS_TOKEN');
