(()=>{
 const link=document.getElementById('authLink');
 async function me(){try{const r=await fetch('/api/auth/me',{credentials:'same-origin'});if(!r.ok)return null;const d=await r.json();return d.user||null}catch{return null}}
 async function requireLogin(){if(await me())return true;if(confirm('保存到云端图纸库需要先登录。现在去登录吗？'))location.href='login.html?next='+encodeURIComponent(location.pathname+location.search);return false}
 window.DoudouAuth={me,requireLogin};
 if(link)me().then(user=>{if(user){link.textContent='👤 '+user.email;link.href='account.html'}else{link.textContent='👤 登录 / 注册';link.href='login.html'}});
})();