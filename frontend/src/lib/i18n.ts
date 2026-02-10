export type Language = 'en' | 'vi';

export const translations = {
  en: {
    // App
    appName: 'Schulte Table',
    loading: 'Loading...',

    // Home
    sessions: 'Sessions',
    streak: 'Streak',
    best: 'Best',
    gridSize: 'Grid Size',
    timeLimit: 'Time Limit',
    order: 'Order',
    startTraining: 'Start Training',

    // Settings
    settings: 'Settings',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    hapticFeedback: 'Haptic Feedback',
    vibrateOnTap: 'Vibrate on tap',
    showHints: 'Show Hints',
    highlightNext: 'Highlight next number',
    fixationDot: 'Fixation Dot',
    centerEyeAnchor: 'Center eye anchor',
    language: 'Language',
    english: 'English',
    vietnamese: 'Tiếng Việt',
    saveDefault: 'Save Current Settings as Default',
    close: 'Close',

    // Help
    howToPlay: 'How to Play',
    whatIsSchulte: 'What is a Schulte Table?',
    schulteDescription: 'A Schulte Table is a grid of randomly arranged numbers used to train your focus, peripheral vision, and mental speed. It\'s used by athletes, pilots, and students worldwide.',
    howToPlayTitle: 'How to Play',
    step1Title: 'Configure your game',
    step1Desc: 'Choose grid size, time limit, and order',
    step2Title: 'Find numbers in order',
    step2Desc: 'Tap 1, 2, 3... (ascending) or tap in descending order',
    step3Title: 'Beat the clock',
    step3Desc: 'Complete before time runs out. Fewer mistakes = better score!',
    proTips: 'Pro Tips',
    tip1: 'Focus on the center.',
    tip1Desc: 'Use peripheral vision to spot numbers without moving your eyes too much.',
    tip2: 'Accuracy over speed.',
    tip2Desc: 'Wrong taps waste time. Be precise!',
    tip3: 'Practice daily.',
    tip3Desc: 'Even 3-5 minutes a day improves focus significantly.',
    tip4: 'Track progress.',
    tip4Desc: 'Check your history to see improvement over time.',
    gotIt: 'Got it!',

    // Game
    elapsed: 'Elapsed',
    find: 'Find',
    next: 'Next',
    progress: 'Progress',
    mistakes: 'Mistakes',
    paused: 'PAUSED',
    tapToStart: 'Tap the first number to start',

    // Results
    newBest: 'New Best!',
    completed: 'Completed!',
    timesUp: "Time's Up!",
    time: 'Time',
    accuracy: 'Accuracy',
    grid: 'Grid',
    personalBest: 'Personal best',
    newPersonalBest: 'New personal best!',
    home: 'Home',
    playAgain: 'Play Again',

    // History
    history: 'History',
    noSessions: 'No training sessions yet',
    startFirst: 'Start your first session',
    sessionDetails: 'Session Details',
    deleteSession: 'Delete Session',
    ascending: 'Ascending',
    descending: 'Descending',
    timeout: 'timeout',
    abandoned: 'abandoned',
  },
  vi: {
    // App
    appName: 'Bảng Schulte',
    loading: 'Đang tải...',

    // Home
    sessions: 'Phiên',
    streak: 'Chuỗi',
    best: 'Tốt nhất',
    gridSize: 'Kích thước',
    timeLimit: 'Giới hạn thời gian',
    order: 'Thứ tự',
    startTraining: 'Bắt đầu luyện tập',

    // Settings
    settings: 'Cài đặt',
    theme: 'Giao diện',
    light: 'Sáng',
    dark: 'Tối',
    system: 'Hệ thống',
    hapticFeedback: 'Phản hồi rung',
    vibrateOnTap: 'Rung khi chạm',
    showHints: 'Hiện gợi ý',
    highlightNext: 'Tô sáng số tiếp theo',
    fixationDot: 'Điểm cố định',
    centerEyeAnchor: 'Điểm neo mắt ở giữa',
    language: 'Ngôn ngữ',
    english: 'English',
    vietnamese: 'Tiếng Việt',
    saveDefault: 'Lưu cài đặt làm mặc định',
    close: 'Đóng',

    // Help
    howToPlay: 'Cách chơi',
    whatIsSchulte: 'Bảng Schulte là gì?',
    schulteDescription: 'Bảng Schulte là một lưới các số được sắp xếp ngẫu nhiên, dùng để rèn luyện sự tập trung, tầm nhìn ngoại vi và tốc độ tư duy. Nó được sử dụng bởi vận động viên, phi công và học sinh trên toàn thế giới.',
    howToPlayTitle: 'Cách chơi',
    step1Title: 'Cấu hình trò chơi',
    step1Desc: 'Chọn kích thước lưới, giới hạn thời gian và thứ tự',
    step2Title: 'Tìm số theo thứ tự',
    step2Desc: 'Chạm 1, 2, 3... (tăng dần) hoặc chạm theo thứ tự giảm dần',
    step3Title: 'Đánh bại đồng hồ',
    step3Desc: 'Hoàn thành trước khi hết giờ. Ít sai = điểm cao!',
    proTips: 'Mẹo hay',
    tip1: 'Tập trung vào trung tâm.',
    tip1Desc: 'Sử dụng tầm nhìn ngoại vi để phát hiện số mà không cần di chuyển mắt quá nhiều.',
    tip2: 'Chính xác hơn tốc độ.',
    tip2Desc: 'Chạm sai sẽ lãng phí thời gian. Hãy chính xác!',
    tip3: 'Luyện tập hàng ngày.',
    tip3Desc: 'Chỉ 3-5 phút mỗi ngày cũng cải thiện sự tập trung đáng kể.',
    tip4: 'Theo dõi tiến trình.',
    tip4Desc: 'Kiểm tra lịch sử để xem sự tiến bộ theo thời gian.',
    gotIt: 'Đã hiểu!',

    // Game
    elapsed: 'Đã trôi qua',
    find: 'Tìm',
    next: 'Tiếp theo',
    progress: 'Tiến độ',
    mistakes: 'Lỗi',
    paused: 'TẠM DỪNG',
    tapToStart: 'Chạm số đầu tiên để bắt đầu',

    // Results
    newBest: 'Kỷ lục mới!',
    completed: 'Hoàn thành!',
    timesUp: 'Hết giờ!',
    time: 'Thời gian',
    accuracy: 'Độ chính xác',
    grid: 'Lưới',
    personalBest: 'Kỷ lục cá nhân',
    newPersonalBest: 'Kỷ lục cá nhân mới!',
    home: 'Trang chủ',
    playAgain: 'Chơi lại',

    // History
    history: 'Lịch sử',
    noSessions: 'Chưa có phiên luyện tập nào',
    startFirst: 'Bắt đầu phiên đầu tiên',
    sessionDetails: 'Chi tiết phiên',
    deleteSession: 'Xóa phiên',
    ascending: 'Tăng dần',
    descending: 'Giảm dần',
    timeout: 'hết giờ',
    abandoned: 'bỏ dở',
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

export function getTranslation(lang: Language, key: TranslationKey): string {
  return translations[lang][key] || translations.en[key] || key;
}
