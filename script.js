document.addEventListener('DOMContentLoaded', function() {

    // --- ローディング画面の処理 ---
    const loadingScreen = document.getElementById('loading-screen');
    setTimeout(() => {
        loadingScreen.style.opacity = '0';
        // アニメーション終了後に非表示にし、インタラクションを妨げないようにする
        setTimeout(() => {
            loadingScreen.style.display = 'none';
        }, 500); // この時間はCSSのtransition時間と一致させる必要があります
    }, 1500); // 1.5秒後にフェードアウトを開始
    
    // 必要なDOM要素を取得
    let video1 = document.getElementById('video1');
    let video2 = document.getElementById('video2');
    const micButton = document.getElementById('mic-button');
    const favorabilityBar = document.getElementById('favorability-bar');

    let activeVideo = video1;
    let inactiveVideo = video2;

    // ビデオリスト
    const videoList = [
        'video_assets/3d_model_intro.mp4',
        'video_assets/smile_and_sway.mp4',
        'video_assets/v-sign_and_sway.mp4',
        'video_assets/cheering_video.mp4',
        'video_assets/dancing_video.mp4',
        'video_assets/negative/angry_muttering.mp4'
    ];

    // --- ビデオのクロスフェード再生機能 ---
    function switchVideo() {
        // 1. 次のビデオを選択
        const currentVideoSrc = activeVideo.querySelector('source').getAttribute('src');
        let nextVideoSrc = currentVideoSrc;
        while (nextVideoSrc === currentVideoSrc) {
            const randomIndex = Math.floor(Math.random() * videoList.length);
            nextVideoSrc = videoList[randomIndex];
        }

        // 2. 非アクティブなvideo要素のsourceを設定
        inactiveVideo.querySelector('source').setAttribute('src', nextVideoSrc);
        inactiveVideo.load();

        // 3. 非アクティブなビデオが再生可能になったら、切り替えを実行
        inactiveVideo.addEventListener('canplaythrough', function onCanPlayThrough() {
            // イベントが一度だけ発火するようにする
            inactiveVideo.removeEventListener('canplaythrough', onCanPlayThrough);

            // 4. 新しいビデオを再生
            inactiveVideo.play().catch(error => {
                console.error("Video play failed:", error);
            });

            // 5. activeクラスを切り替えてCSSトランジションを発火させる
            activeVideo.classList.remove('active');
            inactiveVideo.classList.add('active');

            // 6. 役割を更新
            [activeVideo, inactiveVideo] = [inactiveVideo, activeVideo];

            // 新しいactiveVideoにendedイベントをバインドする
            activeVideo.addEventListener('ended', switchVideo, { once: true });
        }, { once: true }); // { once: true } を使用して、イベントが一度だけ処理されるようにする
    }

    // 初期起動
    activeVideo.addEventListener('ended', switchVideo, { once: true });


    // --- 音声認識のコア ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    // ブラウザが音声認識をサポートしているか確認
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; // 継続的に認識
        recognition.lang = 'ja-JP'; // 言語を日本語に設定
        recognition.interimResults = true; // 仮の結果を取得

        recognition.onresult = (event) => {
            const transcriptContainer = document.getElementById('transcript');
            let final_transcript = '';
            let interim_transcript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            
            // 最終的な認識結果を表示
            transcriptContainer.textContent = final_transcript || interim_transcript;
            
            // キーワードに基づく感情分析とビデオ切り替え
            if (final_transcript) {
                analyzeAndReact(final_transcript);
            }
        };

        recognition.onerror = (event) => {
            console.error('音声認識エラー:', event.error);
        };

    } else {
        console.log('お使いのブラウザは音声認識機能に対応していません。');
        // UI上でユーザーにヒントを表示することも可能
    }

    // --- マイクボタンのインタラクション ---
    let isListening = false;

    micButton.addEventListener('click', function() {
        if (!SpeechRecognition) return; // サポートされていない場合は何もしない

        isListening = !isListening;
        micButton.classList.toggle('is-listening', isListening);
        const transcriptContainer = document.querySelector('.transcript-container');
        const transcriptText = document.getElementById('transcript');

        if (isListening) {
            transcriptText.textContent = '聞いています...'; // すぐにヒントを表示
            transcriptContainer.classList.add('visible');
            recognition.start();
        } else {
            recognition.stop();
            transcriptContainer.classList.remove('visible');
            transcriptText.textContent = ''; // テキストをクリア
        }
    });


    // --- 感情分析と反応 ---
    const positiveWords = ['嬉しい', '楽しい', '好き', '最高', 'こんにちは', '綺麗', 'かわいい'];
    const negativeWords = ['悲しい', '怒ってる', '嫌い', '辛い', '最悪'];

    const positiveVideos = [
        'video_assets/smile_and_sway.mp4',
        'video_assets/v-sign_and_sway.mp4',
        'video_assets/cheering_video.mp4',
        'video_assets/dancing_video.mp4'
    ];
    const negativeVideo = 'video_assets/negative/angry_muttering.mp4';

    function analyzeAndReact(text) {
        let reaction = 'neutral'; // デフォルトはニュートラル

        if (positiveWords.some(word => text.includes(word))) {
            reaction = 'positive';
        } else if (negativeWords.some(word => text.includes(word))) {
            reaction = 'negative';
        }

        if (reaction !== 'neutral') {
            switchVideoByEmotion(reaction);
        }
    }

    function switchVideoByEmotion(emotion) {
        let nextVideoSrc;
        if (emotion === 'positive') {
            const randomIndex = Math.floor(Math.random() * positiveVideos.length);
            nextVideoSrc = positiveVideos[randomIndex];
        } else { // negative
            nextVideoSrc = negativeVideo;
        }

        // 同じビデオの繰り返し再生を避ける
        const currentVideoSrc = activeVideo.querySelector('source').getAttribute('src');
        if (nextVideoSrc === currentVideoSrc) return;

        // --- 以下のロジックはswitchVideo関数と似ており、ビデオの切り替えに使用 ---
        inactiveVideo.querySelector('source').setAttribute('src', nextVideoSrc);
        inactiveVideo.load();

        inactiveVideo.addEventListener('canplaythrough', function onCanPlayThrough() {
            inactiveVideo.removeEventListener('canplaythrough', onCanPlayThrough);
            inactiveVideo.play().catch(error => console.error("Video play failed:", error));
            activeVideo.classList.remove('active');
            inactiveVideo.classList.add('active');
            [activeVideo, inactiveVideo] = [inactiveVideo, activeVideo];
            // 感情によってトリガーされたビデオの再生終了後、ランダム再生に戻る
            activeVideo.addEventListener('ended', switchVideo, { once: true });
        }, { once: true });
    }

});