import { fetchAPI } from '../utils/api';

export function registerAuthPages(Alpine) {
  Alpine.data('loginPage', () => ({
    phone: '',
    password: '',
    error: '',
    loading: false,

    async login() {
      this.loading = true;
      this.error = '';
      try {
        await Alpine.store('auth').login(this.phone, this.password);
        window.location.href = '/tai-khoan.html';
      } catch (e) {
        this.error = e.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại.';
      } finally {
        this.loading = false;
      }
    },
  }));

  Alpine.data('registerPage', () => ({
    fullName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    error: '',
    loading: false,

    validatePassword(pw) {
      if (pw.length < 8) return 'Mật khẩu phải có ít nhất 8 ký tự.';
      if (!/[A-Z]/.test(pw)) return 'Mật khẩu phải chứa ít nhất 1 chữ cái viết hoa.';
      if (!/[a-z]/.test(pw)) return 'Mật khẩu phải chứa ít nhất 1 chữ cái viết thường.';
      if (!/[0-9]/.test(pw)) return 'Mật khẩu phải chứa ít nhất 1 chữ số.';
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) return 'Mật khẩu phải chứa ít nhất 1 ký tự đặc biệt (!@#$%...).';
      return null;
    },

    get passwordStrength() {
      const pw = this.password;
      if (!pw) return { level: 0, label: '', color: '' };
      let score = 0;
      if (pw.length >= 8) score++;
      if (/[A-Z]/.test(pw)) score++;
      if (/[a-z]/.test(pw)) score++;
      if (/[0-9]/.test(pw)) score++;
      if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pw)) score++;
      if (score <= 2) return { level: score, label: 'Yếu', color: 'bg-red-500' };
      if (score <= 3) return { level: score, label: 'Trung bình', color: 'bg-yellow-500' };
      if (score <= 4) return { level: score, label: 'Khá', color: 'bg-blue-500' };
      return { level: score, label: 'Mạnh', color: 'bg-green-500' };
    },

    async register() {
      if (!this.fullName.trim()) {
        this.error = 'Vui lòng nhập họ và tên.';
        return;
      }
      if (!this.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email.trim())) {
        this.error = 'Vui lòng nhập email hợp lệ.';
        return;
      }
      const pwError = this.validatePassword(this.password);
      if (pwError) {
        this.error = pwError;
        return;
      }
      if (this.password !== this.confirmPassword) {
        this.error = 'Mật khẩu không khớp.';
        return;
      }
      this.loading = true;
      this.error = '';
      try {
        await Alpine.store('auth').register(this.fullName, this.phone, this.email, this.password);
        window.location.href = '/tai-khoan.html';
      } catch (e) {
        this.error = e.message || 'Đăng ký thất bại. Vui lòng thử lại.';
      } finally {
        this.loading = false;
      }
    },
  }));

  Alpine.data('profilePage', () => ({
    loading: true,
    editing: false,
    editName: '',
    editError: '',
    editSuccess: false,
    saving: false,

    async init() {
      if (!Alpine.store('auth').isLoggedIn) {
        window.location.href = '/dang-nhap.html';
        return;
      }
      await Alpine.store('auth').fetchProfile();
      this.editName = this.user?.fullName || '';
      this.loading = false;
    },

    get user() {
      return Alpine.store('auth').user;
    },

    async saveProfile() {
      if (!this.editName.trim()) {
        this.editError = 'Vui lòng nhập họ và tên.';
        return;
      }
      this.saving = true;
      this.editError = '';
      this.editSuccess = false;
      try {
        const res = await fetchAPI('/phone-auth/update-profile', {
          method: 'PUT',
          auth: true,
          body: JSON.stringify({ fullName: this.editName.trim() }),
        });
        // Update local user data
        const updatedUser = { ...Alpine.store('auth').user, fullName: this.editName.trim() };
        Alpine.store('auth').user = updatedUser;
        localStorage.setItem('user', JSON.stringify(updatedUser));
        this.editSuccess = true;
        setTimeout(() => { this.editing = false; this.editSuccess = false; }, 1500);
      } catch (e) {
        this.editError = e.message || 'Cập nhật thất bại.';
      } finally {
        this.saving = false;
      }
    },

    get kycLabel() {
      const status = this.user?.kycStatus;
      const labels = { pending: 'Đang chờ', verified: 'Đã xác minh', rejected: 'Bị từ chối' };
      return labels[status] || 'Chưa xác minh';
    },

    get kycColor() {
      const status = this.user?.kycStatus;
      const colors = { pending: 'text-warning', verified: 'text-success', rejected: 'text-error' };
      return colors[status] || 'text-gray-500';
    },

    logout() {
      Alpine.store('auth').logout();
    },

    kycFiles: [],
    submittingKyc: false,
    kycError: '',
    kycSuccess: '',
    kycExtracted: false,
    cccdPreview: '',
    cccdImageId: null,
    cameraActive: false,
    cameraStream: null,
    kycForm: {
      cccdNumber: '',
      fullName: '',
      dateOfBirth: '',
      gender: '',
      placeOfOrigin: '',
      placeOfResidence: '',
      cccdExpiry: '',
    },

    handleFileDrop(e) {
      this.kycFiles = [...e.dataTransfer.files].slice(0, 2);
    },

    handleFileSelect(e) {
      this.kycFiles = [...e.target.files].slice(0, 2);
    },

    autoDetectInterval: null,
    autoDetectReady: false,
    autoDetectCountdown: 0,
    autoDetectStatus: 'Đang tìm CCCD...',

    async startCamera() {
      this.kycError = '';
      try {
        // Try multiple camera configs for better compatibility
        let stream = null;
        const configs = [
          { video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          { video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
          { video: true, audio: false },
        ];

        for (const config of configs) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(config);
            console.log('[Camera] Success with config:', JSON.stringify(config));
            break;
          } catch (err) {
            console.log('[Camera] Failed config:', JSON.stringify(config), err.name);
          }
        }

        if (!stream) throw new Error('No camera available');

        this.cameraStream = stream;
        this.cameraActive = true;
        this.autoDetectReady = false;
        this.autoDetectCountdown = 0;
        this.autoDetectStatus = 'Đang tìm CCCD...';
        this.$nextTick(() => {
          const video = this.$refs.cameraVideo;
          if (video) {
            video.srcObject = stream;
            video.play().then(() => {
              this.startAutoDetect();
            }).catch(() => {});
          }
        });
      } catch (e) {
        console.error('[Camera] Error:', e);
        this.kycError = 'Không thể mở camera: ' + (e.message || e.name || 'Vui lòng dùng nút "Chọn ảnh".');
      }
    },

    startAutoDetect() {
      const video = this.$refs.cameraVideo;
      const canvas = this.$refs.cameraCanvas;
      if (!video || !canvas) return;

      let stableFrames = 0;
      const REQUIRED_STABLE = 30; // ~3s stable = auto capture

      this.autoDetectInterval = setInterval(() => {
        if (!this.cameraActive || this.submittingKyc) return;

        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Analyze the center region (where CCCD guide overlay is)
        const cx = Math.floor(canvas.width * 0.075);
        const cy = Math.floor(canvas.height * 0.125);
        const cw = Math.floor(canvas.width * 0.85);
        const ch = Math.floor(canvas.height * 0.75);
        const imageData = ctx.getImageData(cx, cy, cw, ch);
        const pixels = imageData.data;

        // Detect if there's a card-like object:
        // 1. Check edge contrast (card edges vs background)
        // 2. Check brightness (card is usually lighter than hand/table)
        // 3. Check color variance (card has text = high variance)
        let totalBrightness = 0;
        let brightPixels = 0;
        let edgePixels = 0;
        const step = 16; // sample every 16th pixel for speed

        for (let i = 0; i < pixels.length; i += step * 4) {
          const r = pixels[i], g = pixels[i+1], b = pixels[i+2];
          const brightness = (r + g + b) / 3;
          totalBrightness += brightness;
          if (brightness > 140) brightPixels++;

          // Check for edges (high contrast neighbors)
          if (i + step * 4 < pixels.length) {
            const r2 = pixels[i + step*4], g2 = pixels[i+1 + step*4], b2 = pixels[i+2 + step*4];
            const diff = Math.abs(r-r2) + Math.abs(g-g2) + Math.abs(b-b2);
            if (diff > 80) edgePixels++;
          }
        }

        const totalSampled = Math.floor(pixels.length / (step * 4));
        const brightRatio = brightPixels / totalSampled;
        const edgeRatio = edgePixels / totalSampled;
        const avgBrightness = totalBrightness / totalSampled;

        // Card detected: needs high brightness (white card surface) + high edge count (text/features) + not too dark/bright
        const cardDetected = brightRatio > 0.55 && edgeRatio > 0.12 && avgBrightness > 130 && avgBrightness < 220;

        if (cardDetected) {
          stableFrames++;
          if (stableFrames >= REQUIRED_STABLE && !this.submittingKyc) {
            // Auto capture!
            this.autoDetectStatus = 'Đã phát hiện! Đang chụp...';
            clearInterval(this.autoDetectInterval);
            this.autoDetectInterval = null;
            this.capturePhoto();
            return;
          }
          const remaining = Math.ceil((REQUIRED_STABLE - stableFrames) / 10);
          this.autoDetectStatus = `Giữ yên... ${remaining > 0 ? remaining + 's' : ''}`;
          this.autoDetectReady = true;
        } else {
          stableFrames = Math.max(0, stableFrames - 3);
          this.autoDetectStatus = 'Đang tìm CCCD... Đặt thẻ vào khung';
          this.autoDetectReady = false;
        }
      }, 100); // Check every 100ms
    },

    stopCamera() {
      if (this.autoDetectInterval) {
        clearInterval(this.autoDetectInterval);
        this.autoDetectInterval = null;
      }
      if (this.cameraStream) {
        this.cameraStream.getTracks().forEach(t => t.stop());
        this.cameraStream = null;
      }
      this.cameraActive = false;
      this.autoDetectReady = false;
    },

    async capturePhoto() {
      try {
        const video = this.$refs.cameraVideo;
        const canvas = this.$refs.cameraCanvas;
        if (!video || !canvas) {
          this.kycError = 'Lỗi camera. Vui lòng thử lại hoặc dùng "Chọn ảnh".';
          this.stopCamera();
          return;
        }

        // Capture frame
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Stop camera first
        this.stopCamera();

        // Convert to blob
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob(b => {
            if (b) resolve(b);
            else reject(new Error('Không thể chụp ảnh'));
          }, 'image/jpeg', 0.92);
        });

        const file = new File([blob], 'cccd-capture-' + Date.now() + '.jpg', { type: 'image/jpeg' });
        await this.processCccdFile(file);
      } catch (e) {
        this.stopCamera();
        this.kycError = 'Lỗi khi chụp ảnh: ' + (e.message || 'Vui lòng thử lại.');
      }
    },

    handleCccdDrop(e) {
      const file = e.dataTransfer.files[0];
      if (file) this.processCccdFile(file);
    },

    handleCccdSelect(e) {
      const file = e.target.files[0];
      if (file) this.processCccdFile(file);
    },

    async processCccdFile(file) {
      this.kycError = '';
      this.kycSuccess = '';
      this.submittingKyc = true;

      // Show preview
      this.cccdPreview = URL.createObjectURL(file);

      try {
        // Step 1: Upload image
        console.log('[KYC] Uploading image...');
        const uploaded = await Alpine.store('auth').uploadFile(file);
        console.log('[KYC] Uploaded:', uploaded?.id, uploaded?.name);
        this.cccdImageId = uploaded.id;

        // Step 2: Try OCR
        let ocrWorked = false;
        try {
          console.log('[KYC] Calling OCR...');
          const ocrResult = await Alpine.store('auth').submitKycOcr(uploaded.id, 'front');
          console.log('[KYC] OCR result:', ocrResult);
          if (ocrResult.success && ocrResult.data) {
            const d = ocrResult.data;
            this.kycForm.cccdNumber = d.id || '';
            this.kycForm.fullName = d.name || '';
            this.kycForm.dateOfBirth = d.dob || '';
            this.kycForm.gender = d.sex || '';
            this.kycForm.placeOfOrigin = d.home || '';
            this.kycForm.placeOfResidence = d.address || '';
            this.kycForm.cccdExpiry = d.doe || '';
            ocrWorked = true;

            if (ocrResult.user?.kycStatus === 'verified') {
              this.kycSuccess = 'Xác minh CCCD thành công!';
              this.kycExtracted = true;
              setTimeout(() => window.location.reload(), 1500);
              return;
            }
          }
        } catch (ocrErr) {
          console.log('[KYC] OCR error (continuing to manual):', ocrErr);
        }

        // Show manual form
        if (!ocrWorked) {
          this.kycForm.fullName = this.user?.fullName || '';
        }
        this.kycExtracted = true;
        this.kycSuccess = ocrWorked
          ? 'Nhận dạng thành công! Vui lòng kiểm tra thông tin bên dưới.'
          : 'Ảnh đã tải lên thành công. Vui lòng nhập thông tin CCCD bên dưới.';
        console.log('[KYC] Form shown, kycExtracted:', this.kycExtracted);
      } catch (e) {
        console.error('[KYC] Upload error:', e);
        this.kycError = e.message || 'Lỗi khi tải ảnh. Vui lòng thử lại.';
      } finally {
        this.submittingKyc = false;
      }
    },

    async confirmKyc() {
      if (!this.kycForm.cccdNumber || !this.kycForm.fullName) {
        this.kycError = 'Vui lòng nhập số CCCD và họ tên.';
        return;
      }
      this.submittingKyc = true;
      this.kycError = '';

      try {
        const data = {
          ...this.kycForm,
          images: this.cccdImageId ? [this.cccdImageId] : [],
        };
        await Alpine.store('auth').submitKycManual(data);
        this.kycSuccess = 'Đã gửi thông tin xác minh thành công!';
        setTimeout(() => window.location.reload(), 1500);
      } catch (e) {
        this.kycError = e.message || 'Lỗi khi gửi thông tin.';
      } finally {
        this.submittingKyc = false;
      }
    },

    async uploadKyc() {
      if (this.kycFiles.length !== 2) {
        this.kycError = 'Vui lòng chọn đủ 2 ảnh (mặt trước và mặt sau).';
        return;
      }
      this.submittingKyc = true;
      this.kycError = '';

      try {
        await Alpine.store('auth').submitKyc(this.kycFiles);
        window.location.reload();
      } catch (e) {
        this.kycError = e.message || 'Lỗi khi tải lên hồ sơ.';
      } finally {
        this.submittingKyc = false;
      }
    }
  }));
}
